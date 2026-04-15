import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { ContractsV1, ErrorCodes } from '@tracked/shared';
import { randomUUID } from 'node:crypto';

interface TopicRow {
  id: string;
  slug: string;
  title: string;
}

export class TopicsRepository {
  constructor(private readonly pool: Pool | null) {}

  private static slugify(title: string): string {
    const base = title
      .trim()
      .toLowerCase()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9а-яё\s-]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return base || 'topic';
  }

  async createOrGetByTitle(titleRaw: string): Promise<ContractsV1.TopicV1> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const title = String(titleRaw ?? '').trim();
    if (!title) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'title must be non-empty' });
    }

    const existing = await this.pool.query<TopicRow>(
      `SELECT id, slug, title FROM topics WHERE LOWER(title) = LOWER($1) LIMIT 1`,
      [title],
    );
    if (existing.rows[0]) {
      const r = existing.rows[0];
      return { id: r.id, slug: r.slug, title: r.title };
    }

    const id = randomUUID();
    const baseSlug = TopicsRepository.slugify(title);
    for (let i = 0; i < 10; i++) {
      const slug = i === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(16).slice(2, 6)}`;
      try {
        const res = await this.pool.query<TopicRow>(
          `INSERT INTO topics (id, slug, title) VALUES ($1, $2, $3) RETURNING id, slug, title`,
          [id, slug, title],
        );
        const r = res.rows[0];
        return { id: r.id, slug: r.slug, title: r.title };
      } catch {
        // assume conflict, retry with different slug
      }
    }
    throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Failed to create topic' });
  }

  async listAll(): Promise<ContractsV1.TopicV1[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<TopicRow>(
      `SELECT id, slug, title FROM topics ORDER BY title ASC`,
    );
    return res.rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title }));
  }

  async listForCourse(courseId: string): Promise<ContractsV1.TopicV1[]> {
    if (!this.pool) return [];
    const res = await this.pool.query<TopicRow>(
      `
      SELECT t.id, t.slug, t.title
      FROM topics t
      JOIN course_topics ct ON ct.topic_id = t.id
      WHERE ct.course_id = $1
      ORDER BY t.title ASC
      `,
      [courseId],
    );
    return res.rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title }));
  }

  async setCourseTopics(params: {
    expertId: string;
    courseId: string;
    topicIds: string[];
  }): Promise<void> {
    if (!this.pool) {
      throw new Error('Database is disabled (SKIP_DB=1). Cannot perform database operations.');
    }
    const c = await this.pool.query<{ id: string }>(
      `SELECT id FROM courses WHERE id = $1 AND expert_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [params.courseId, params.expertId],
    );
    if (c.rows.length === 0) {
      throw new NotFoundException({
        code: ErrorCodes.COURSE_NOT_FOUND,
        message: 'Course not found',
      });
    }
    const unique = [...new Set(params.topicIds)];
    if (unique.length !== params.topicIds.length) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Duplicate topic ids',
      });
    }
    if (unique.length > 0) {
      const chk = await this.pool.query<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM topics WHERE id = ANY($1::uuid[])`,
        [unique],
      );
      const cnt = parseInt(chk.rows[0]?.cnt ?? '0', 10);
      if (cnt !== unique.length) {
        throw new BadRequestException({
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Unknown topic id',
        });
      }
    }
    await this.pool.query(`DELETE FROM course_topics WHERE course_id = $1`, [params.courseId]);
    for (const tid of unique) {
      await this.pool.query(
        `INSERT INTO course_topics (course_id, topic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [params.courseId, tid],
      );
    }
  }
}
