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
import { JwtService } from '../auth/session/jwt.service.js';

@ApiTags('Files')
@Controller()
export class FilesController {
  constructor(
    private readonly storage: S3StorageService,
    private readonly jwtService: JwtService,
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
    const cleanKey = String(key ?? '').trim();
    if (!cleanKey) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'key is required' });
    }
    const isSubmission = cleanKey.startsWith('submissions/');
    const isAvatar = cleanKey.startsWith(`avatars/${userId}/`);
    const isLessonPresentation = cleanKey.startsWith('lesson-presentations/');
    if (!isSubmission && !isAvatar && !isLessonPresentation) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }
    if (isSubmission) {
      if (!this.pool) {
        throw new NotFoundException({ code: ErrorCodes.INTERNAL_ERROR, message: 'Database is disabled' });
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
    }
    if (isLessonPresentation) {
      if (!this.pool) {
        throw new NotFoundException({ code: ErrorCodes.INTERNAL_ERROR, message: 'Database is disabled' });
      }
      const parts = cleanKey.split('/');
      const lessonId = parts.length >= 2 ? parts[1] : '';
      if (!lessonId) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
      const meta = await this.pool.query<{ course_id: string; expert_id: string }>(
        `
        SELECT c.id AS course_id, c.expert_id AS expert_id
        FROM lessons l
        JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
        JOIN courses c ON c.id = m.course_id AND c.deleted_at IS NULL
        WHERE l.id = $1 AND l.deleted_at IS NULL
        LIMIT 1
        `,
        [lessonId],
      );
      const row = meta.rows[0];
      if (!row) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });

      const enr = await this.pool.query(
        `
        SELECT 1
        FROM enrollments
        WHERE user_id = $1 AND course_id = $2
          AND revoked_at IS NULL
          AND (access_end IS NULL OR access_end > NOW())
        LIMIT 1
        `,
        [userId, row.course_id],
      );
      if (enr.rows.length > 0) {
        const t = this.jwtService.signFileToken({ userId, key: cleanKey, ttlSeconds: 120 });
        return { url: `/files/public?t=${encodeURIComponent(t)}` };
      }

      const member = await this.pool.query<{ role: string }>(
        `SELECT role FROM expert_members WHERE expert_id = $1 AND user_id = $2 LIMIT 1`,
        [row.expert_id, userId],
      );
      const role = member.rows[0]?.role ?? null;
      if (role === 'owner') {
        const t = this.jwtService.signFileToken({ userId, key: cleanKey, ttlSeconds: 120 });
        return { url: `/files/public?t=${encodeURIComponent(t)}` };
      }
      const access = await this.pool.query(
        `
        SELECT 1
        FROM expert_member_course_access
        WHERE expert_id = $1 AND user_id = $2 AND course_id = $3
        LIMIT 1
        `,
        [row.expert_id, userId, row.course_id],
      );
      if (access.rows.length === 0) {
        throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Forbidden' });
      }
    }
    const t = this.jwtService.signFileToken({ userId, key: cleanKey, ttlSeconds: 120 });
    return { url: `/files/public?t=${encodeURIComponent(t)}` };
  }

  @Get('files/public')
  @ApiOperation({ summary: 'Public file proxy by short-lived token (no auth header required)' })
  @ApiResponse({ status: 200, description: 'File stream' })
  async getPublic(
    @Query('t') token: string,
    @Query('dl') dl: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const cleanToken = String(token ?? '').trim();
    if (!cleanToken) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 't is required' });
    }
    const decoded = this.jwtService.verifyFileToken(cleanToken);
    const key = decoded.key;
    const userId = decoded.userId;

    const isSubmission = key.startsWith('submissions/');
    const isAvatar = key.startsWith(`avatars/${userId}/`);
    const isLessonPresentation = key.startsWith('lesson-presentations/');
    if (!isSubmission && !isAvatar && !isLessonPresentation) {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }

    const obj = await this.storage.getObject({ key });

    // Guess content type for avatars
    if (key.startsWith('avatars/')) {
      reply.header('content-type', obj.contentType ?? 'image/jpeg');
      reply.header('cache-control', 'private, max-age=120');
      reply.header('x-content-type-options', 'nosniff');
      if (obj.contentLength != null) reply.header('content-length', String(obj.contentLength));
      return await reply.send(obj.body as any);
    }

    const lastSeg = key.includes('/') ? key.slice(key.lastIndexOf('/') + 1) : key;
    const asciiName = lastSeg.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_').slice(0, 180) || 'file';
    const wantDownload = typeof dl === 'string' && (dl === '1' || dl.toLowerCase() === 'true');
    const ct = obj.contentType ?? null;
    // Allow embedding PDFs in an <iframe> on the platform domain.
    // Helmet sets X-Frame-Options by default; remove it for this endpoint.
    reply.removeHeader('x-frame-options');
    reply.header('content-security-policy', `frame-ancestors *`);
    reply.header('cross-origin-resource-policy', 'cross-origin');
    reply.header('content-type', ct ?? 'application/octet-stream');
    reply.header('x-content-type-options', 'nosniff');
    reply.header(
      'content-disposition',
      `${wantDownload ? 'attachment' : 'inline'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(lastSeg)}`,
    );
    if (obj.contentLength != null) reply.header('content-length', String(obj.contentLength));
    return await reply.send(obj.body as any);
  }
}

