import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import type { FastifyReply } from 'fastify';
import { S3StorageService } from '../storage/s3-storage.service.js';
import { PlatformLegalDocumentsRepository } from '../modules/admin/platform-legal-documents.repository.js';

const KIND_SCHEMA = ContractsV1.PlatformLegalDocKindV1Schema;

const LEGAL_UNAVAILABLE_HTML = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Документ недоступен</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;color:#333"><p>Документ временно недоступен.</p></body>
</html>`;

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  const chunks: Buffer[] = [];
  const readable = body as AsyncIterable<Uint8Array>;
  for await (const c of readable) {
    chunks.push(Buffer.from(c));
  }
  return Buffer.concat(chunks);
}

@ApiTags('Public Files')
@Controller()
export class PublicLegalDocumentsController {
  constructor(
    private readonly legalDocs: PlatformLegalDocumentsRepository,
    private readonly storage: S3StorageService,
  ) {}

  @Get('public/legal-documents/:kind')
  @ApiOperation({ summary: 'Public legal document PDF by kind (no auth)' })
  @ApiResponse({ status: 200, description: 'PDF stream' })
  @ApiResponse({ status: 404, description: 'Not published' })
  async getPdf(@Param('kind') kindRaw: string, @Res() reply: FastifyReply): Promise<void> {
    const parsed = KIND_SCHEMA.safeParse(kindRaw);
    if (!parsed.success) {
      reply
        .status(404)
        .header('content-type', 'text/html; charset=utf-8')
        .header('cache-control', 'no-store');
      return reply.send(LEGAL_UNAVAILABLE_HTML);
    }
    const kind = parsed.data;
    const row = await this.legalDocs.getRow(kind);
    const pdfKey = row?.pdf_storage_key?.trim();
    if (!pdfKey || !pdfKey.startsWith('platform-legal/')) {
      reply
        .status(404)
        .header('content-type', 'text/html; charset=utf-8')
        .header('cache-control', 'no-store');
      return reply.send(LEGAL_UNAVAILABLE_HTML);
    }

    const obj = await this.storage.getObject({ key: pdfKey });
    const buf = await bodyToBuffer(obj.body);
    if (!buf.length || buf.slice(0, 5).toString('ascii') !== '%PDF-') {
      reply
        .status(404)
        .header('content-type', 'text/html; charset=utf-8')
        .header('cache-control', 'no-store');
      return reply.send(LEGAL_UNAVAILABLE_HTML);
    }

    const filename = `edify-${kind}.pdf`;
    reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', `inline; filename="${filename}"`)
      .header('cross-origin-resource-policy', 'cross-origin')
      .header('cache-control', 'public, max-age=3600');
    return reply.send(buf);
  }
}
