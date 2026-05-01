import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContractsV1 } from '@tracked/shared';
import type { FastifyRequest } from 'fastify';
import { Inject, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';

interface CertRow {
  course_id: string;
  course_title: string;
  cover_url: string | null;
  author_display_name: string | null;
  certificate_pdf_key: string;
  certificate_original_filename: string | null;
  certificate_uploaded_at: Date | null;
  total_lessons: string | number;
  completed_lessons: string | number;
  last_completed_at: Date | null;
}

@ApiTags('User')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeCertificatesController {
  constructor(@Optional() @Inject(Pool) private readonly pool: Pool | null) {}

  @Get('me/certificates')
  @ApiOperation({ summary: 'List my earned certificates (course fully completed + PDF uploaded)' })
  @ApiResponse({ status: 200, description: 'Certificates list' })
  async list(
    @Req() req: FastifyRequest & { user?: { userId: string } },
  ): Promise<ContractsV1.MyCertificatesResponseV1> {
    const userId = req.user?.userId;
    if (!userId || !this.pool) return { items: [] };

    // Probe whether the certificate columns exist (early prod environments may run before migrations).
    let hasCert = false;
    try {
      const probe = await this.pool.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'courses' AND column_name = 'certificate_pdf_key'
           AND table_schema IN ('public', current_schema()::text)`,
      );
      hasCert = probe.rows.length > 0;
    } catch {
      hasCert = false;
    }
    if (!hasCert) return { items: [] };

    const res = await this.pool.query<CertRow>(
      `
      WITH visible_lessons AS (
        SELECT m.course_id AS course_id, l.id AS lesson_id
        FROM lessons l
        JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
        WHERE l.deleted_at IS NULL
          AND l.hidden_from_students = false
      ),
      completed_lessons AS (
        SELECT m.course_id AS course_id, p.lesson_id AS lesson_id, p.completed_at AS completed_at
        FROM lesson_progress p
        JOIN lessons l ON l.id = p.lesson_id AND l.deleted_at IS NULL AND l.hidden_from_students = false
        JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
        WHERE p.user_id = $1
        UNION
        SELECT m.course_id AS course_id, a.lesson_id AS lesson_id, s.decided_at AS completed_at
        FROM submissions s
        JOIN assignments a ON a.id = s.assignment_id
        JOIN lessons l ON l.id = a.lesson_id AND l.deleted_at IS NULL AND l.hidden_from_students = false
        JOIN course_modules m ON m.id = l.module_id AND m.deleted_at IS NULL
        WHERE s.student_user_id = $1 AND s.score IS NOT NULL
      )
      SELECT
        c.id AS course_id,
        c.title AS course_title,
        c.cover_url AS cover_url,
        c.author_display_name AS author_display_name,
        c.certificate_pdf_key AS certificate_pdf_key,
        c.certificate_original_filename AS certificate_original_filename,
        c.certificate_uploaded_at AS certificate_uploaded_at,
        COALESCE((SELECT COUNT(*)::int FROM visible_lessons vl WHERE vl.course_id = c.id), 0) AS total_lessons,
        COALESCE((SELECT COUNT(DISTINCT cl.lesson_id)::int FROM completed_lessons cl WHERE cl.course_id = c.id), 0) AS completed_lessons,
        (SELECT MAX(cl.completed_at) FROM completed_lessons cl WHERE cl.course_id = c.id) AS last_completed_at
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id AND c.deleted_at IS NULL
      WHERE e.user_id = $1
        AND e.revoked_at IS NULL
        AND (e.access_end IS NULL OR e.access_end > NOW())
        AND c.certificate_pdf_key IS NOT NULL
      ORDER BY c.updated_at DESC
      `,
      [userId],
    );

    const items: ContractsV1.MyCertificateV1[] = [];
    for (const row of res.rows) {
      const total = typeof row.total_lessons === 'number' ? row.total_lessons : parseInt(String(row.total_lessons ?? '0'), 10) || 0;
      const done = typeof row.completed_lessons === 'number' ? row.completed_lessons : parseInt(String(row.completed_lessons ?? '0'), 10) || 0;
      if (total <= 0 || done < total) continue;
      const filename = (row.certificate_original_filename ?? '').trim() || null;
      items.push({
        courseId: row.course_id,
        courseTitle: row.course_title,
        coverUrl: row.cover_url,
        authorDisplayName: (row.author_display_name ?? '').trim() || null,
        pdfKey: row.certificate_pdf_key,
        pdfFilename: filename,
        uploadedAt: row.certificate_uploaded_at ? row.certificate_uploaded_at.toISOString() : null,
        completedAt: row.last_completed_at ? row.last_completed_at.toISOString() : null,
      });
    }
    return { items };
  }
}
