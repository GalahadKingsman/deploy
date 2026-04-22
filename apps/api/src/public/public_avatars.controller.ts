import { BadRequestException, Controller, Get, NotFoundException, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorCodes } from '@tracked/shared';
import type { FastifyReply } from 'fastify';
import { S3StorageService } from '../storage/s3-storage.service.js';

@ApiTags('Public Files')
@Controller()
export class PublicAvatarsController {
  constructor(private readonly storage: S3StorageService) {}

  @Get('public/avatar')
  @ApiOperation({ summary: 'Public avatar by key (no auth)' })
  @ApiResponse({ status: 200, description: 'Image stream' })
  async getAvatar(@Query('key') key: string, @Res() reply: FastifyReply): Promise<void> {
    const cleanKey = String(key ?? '').trim();
    if (!cleanKey) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'key is required' });
    }
    if (!cleanKey.startsWith('avatars/')) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }
    const obj = await this.storage.getObject({ key: cleanKey });
    reply.header('cross-origin-resource-policy', 'cross-origin');
    reply.header('x-content-type-options', 'nosniff');
    if (obj.contentType) reply.header('content-type', obj.contentType);
    if (obj.contentLength != null) reply.header('content-length', String(obj.contentLength));
    reply.header('cache-control', 'public, max-age=86400');
    return await reply.send(obj.body as any);
  }
}

