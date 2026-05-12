import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../auth/session/jwt-auth.guard.js';
import { PlatformRoleGuard } from '../../auth/rbac/platform-role.guard.js';
import { RequirePlatformRole } from '../../auth/rbac/require-platform-role.decorator.js';
import { PlatformLegalDocumentsRepository } from './platform-legal-documents.repository.js';
import { S3StorageService } from '../../storage/s3-storage.service.js';
import { AuditService } from '../../audit/audit.service.js';

const KIND_SCHEMA = ContractsV1.PlatformLegalDocKindV1Schema;

function getTraceId(req: FastifyRequest & { traceId?: string }): string | null {
  return typeof req.traceId === 'string' && req.traceId.trim() ? req.traceId.trim() : null;
}

function isDocxBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) return false;
  const third = buf[2];
  const fourth = buf[3];
  if (third === 0x03 && fourth === 0x04) return true;
  if (third === 0x05 && fourth === 0x06) return true;
  if (third === 0x07 && fourth === 0x08) return true;
  return false;
}

@ApiTags('Admin')
@Controller('admin/platform/legal-documents')
@UseGuards(JwtAuthGuard, PlatformRoleGuard)
@ApiBearerAuth()
export class AdminPlatformLegalDocumentsController {
  constructor(
    private readonly legalDocs: PlatformLegalDocumentsRepository,
    private readonly storage: S3StorageService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePlatformRole('admin')
  @ApiOperation({ summary: 'List platform legal documents (admin+)' })
  @ApiResponse({ status: 200, description: 'OK' })
  async list(): Promise<ContractsV1.ListAdminPlatformLegalDocumentsResponseV1> {
    const items = await this.legalDocs.list();
    return { items };
  }

  @Post(':kind/upload')
  @HttpCode(HttpStatus.CREATED)
  @RequirePlatformRole('admin')
  @ApiOperation({ summary: 'Upload platform legal DOCX (admin+)' })
  @ApiResponse({ status: 201, description: 'Uploaded' })
  async upload(
    @Param('kind') kindRaw: string,
    @Req()
    req: FastifyRequest & {
      user?: { userId: string };
      file?: (opts?: unknown) => Promise<unknown>;
    },
  ): Promise<ContractsV1.UploadAdminPlatformLegalDocumentResponseV1> {
    const parsed = KIND_SCHEMA.safeParse(kindRaw);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Некорректный тип документа.',
      });
    }
    const kind = parsed.data;

    const file = await (req as { file?: () => Promise<unknown> }).file?.();
    if (!file) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'file is required' });
    }
    const buf: Buffer = await (file as { toBuffer: () => Promise<Buffer> }).toBuffer();
    if (!buf || buf.length === 0) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Empty file' });
    }
    const maxBytes = 30 * 1024 * 1024;
    if (buf.length > maxBytes) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Файл слишком большой (максимум 30 МБ).',
      });
    }
    const mime = (typeof (file as { mimetype?: string }).mimetype === 'string'
      ? (file as { mimetype: string }).mimetype
      : ''
    ).toLowerCase();
    const isDocxMime =
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword';
    const original =
      typeof (file as { filename?: string }).filename === 'string' && (file as { filename: string }).filename.trim()
        ? (file as { filename: string }).filename.trim()
        : 'document.docx';
    const isDocxExt = /\.docx$/i.test(original);
    if (!isDocxBuffer(buf) && !isDocxMime && !isDocxExt) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Допускается только DOCX.',
      });
    }

    const safeName = original.replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const key = `platform-legal/${kind}/${Date.now()}-${safeName}`;
    const prev = await this.legalDocs.getRow(kind);

    await this.storage.putObject({
      key,
      body: new Uint8Array(buf),
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    let document: ContractsV1.AdminPlatformLegalDocumentV1;
    try {
      document = await this.legalDocs.upsert({
        kind,
        storageKey: key,
        originalFilename: original,
        uploadedByUserId: req.user?.userId ?? null,
      });
    } catch (e) {
      try {
        await this.storage.deleteObject({ key });
      } catch {
        // best-effort
      }
      throw e;
    }
    if (prev?.storage_key && prev.storage_key !== key) {
      try {
        await this.storage.deleteObject({ key: prev.storage_key });
      } catch {
        // best-effort
      }
    }

    await this.audit.write({
      actorUserId: req.user?.userId ?? null,
      action: 'admin.platform_legal.upload',
      entityType: 'platform_legal_document',
      entityId: kind,
      meta: { filename: original },
      traceId: getTraceId(req),
    });

    return { ok: true, document };
  }

  @Delete(':kind')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformRole('admin')
  @ApiOperation({ summary: 'Remove platform legal document (admin+)' })
  @ApiResponse({ status: 200, description: 'Removed' })
  async remove(
    @Param('kind') kindRaw: string,
    @Req() req: FastifyRequest & { user?: { userId: string }; traceId?: string },
  ): Promise<ContractsV1.DeleteAdminPlatformLegalDocumentResponseV1> {
    const parsed = KIND_SCHEMA.safeParse(kindRaw);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Некорректный тип документа.',
      });
    }
    const kind = parsed.data;
    const prev = await this.legalDocs.getRow(kind);
    await this.legalDocs.delete(kind);
    if (prev?.storage_key) {
      try {
        await this.storage.deleteObject({ key: prev.storage_key });
      } catch {
        // best-effort
      }
    }
    const document: ContractsV1.AdminPlatformLegalDocumentV1 = {
      kind,
      uploaded: false,
      originalFilename: null,
      uploadedAt: null,
    };
    await this.audit.write({
      actorUserId: req.user?.userId ?? null,
      action: 'admin.platform_legal.delete',
      entityType: 'platform_legal_document',
      entityId: kind,
      meta: {},
      traceId: getTraceId(req),
    });
    return { ok: true, document };
  }
}
