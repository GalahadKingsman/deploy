import {
  Controller,
  Get,
  NotFoundException,
  Res,
  UseGuards,
  Req,
  ForbiddenException,
  Query,
  BadRequestException,
  Inject,
  Optional,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorCodes } from '@tracked/shared';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { S3StorageService } from '../storage/s3-storage.service.js';
import { Pool } from 'pg';

@ApiTags('Files')
@Controller()
export class FilesController {
  constructor(
    private readonly storage: S3StorageService,
    @Optional() @Inject(Pool) private readonly pool: Pool | null,
  ) {}

  @Get('files')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download file by key (access-controlled)' })
  @ApiResponse({ status: 200, description: 'File stream' })
  async getFile(
    @Query('key') key: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ForbiddenException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    }
    if (!this.pool) {
      throw new NotFoundException({ code: ErrorCodes.INTERNAL_ERROR, message: 'Database is disabled' });
    }

    const cleanKey = String(key ?? '').trim();
    if (!cleanKey) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'key is required' });
    }

    // Only support submissions/* for now
    if (!cleanKey.startsWith('submissions/')) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }

    // Check ownership: student can download only their own submission file
    const res = await this.pool.query<{ file_key: string; student_user_id: string }>(
      `SELECT file_key, student_user_id FROM submissions WHERE file_key = $1 LIMIT 1`,
      [cleanKey],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }
    if (row.student_user_id !== userId) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Forbidden' });
    }

    const obj = await this.storage.getObject({ key: cleanKey });

    const lastSeg = cleanKey.includes('/') ? cleanKey.slice(cleanKey.lastIndexOf('/') + 1) : cleanKey;
    const asciiName = lastSeg.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_').slice(0, 180) || 'file';
    reply.header('content-type', 'application/octet-stream');
    reply.header('x-content-type-options', 'nosniff');
    reply.header(
      'content-disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(lastSeg)}`,
    );
    if (obj.contentLength != null) reply.header('content-length', String(obj.contentLength));

    // AWS SDK v3 returns Node Readable stream in Node.js runtime
    return await reply.send(obj.body as any);
  }

  @Get('files/signed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get signed download URL (access-controlled)' })
  @ApiResponse({ status: 200, description: 'Signed URL' })
  async getSigned(
    @Query('key') key: string,
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<{ url: string }> {
    const userId = req.user?.userId;
    if (!userId) {
      throw new ForbiddenException({ code: ErrorCodes.UNAUTHORIZED, message: 'Unauthorized' });
    }
    if (!this.pool) {
      throw new NotFoundException({ code: ErrorCodes.INTERNAL_ERROR, message: 'Database is disabled' });
    }
    const cleanKey = String(key ?? '').trim();
    if (!cleanKey) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'key is required' });
    }
    if (!cleanKey.startsWith('submissions/')) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }
    const res = await this.pool.query<{ student_user_id: string }>(
      `SELECT student_user_id FROM submissions WHERE file_key = $1 LIMIT 1`,
      [cleanKey],
    );
    const row = res.rows[0];
    if (!row) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    if (row.student_user_id !== userId) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Forbidden' });
    }
    return await this.storage.getSignedGetUrl({ key: cleanKey, expiresSeconds: 120 });
  }
}

