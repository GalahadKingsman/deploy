import { Injectable, Optional, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import type { ContractsV1 } from '@tracked/shared';

export interface AuditListParams {
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  traceId?: string;
  from?: string; // iso datetime
  to?: string; // iso datetime
  limit: number;
  /** Decoded cursor (validated by controller); do not pass raw string */
  cursorDecoded?: { createdAt: string; id: string };
}

export interface AuditListResult {
  items: ContractsV1.AuditLogEntryV1[];
  nextCursor?: string;
}

interface AuditRow {
  id: string;
  created_at: Date;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  trace_id: string | null;
  meta: unknown;
}

function rowToEntry(row: AuditRow): ContractsV1.AuditLogEntryV1 {
  const entry: ContractsV1.AuditLogEntryV1 = {
    id: row.id,
    createdAt: row.created_at.toISOString(),
    actorUserId: row.actor_user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    traceId: row.trace_id,
    meta: row.meta ?? null,
  };
  return entry;
}

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id }), 'utf-8').toString('base64');
}

/**
 * Read-only audit repository for admin list and listActions.
 */
@Injectable()
export class AuditRepository {
  constructor(@Optional() @Inject(Pool) private readonly pool: Pool | null) {}

  async list(params: AuditListParams): Promise<AuditListResult> {
    if (!this.pool) {
      return { items: [] };
    }

    const limit = Math.min(Math.max(1, params.limit), 200);
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.actorUserId !== undefined && params.actorUserId !== '') {
      conditions.push(`actor_user_id = $${paramIndex}`);
      values.push(params.actorUserId);
      paramIndex += 1;
    }
    if (params.action !== undefined && params.action !== '') {
      conditions.push(`action = $${paramIndex}`);
      values.push(params.action);
      paramIndex += 1;
    }
    if (params.entityType !== undefined && params.entityType !== '') {
      conditions.push(`entity_type = $${paramIndex}`);
      values.push(params.entityType);
      paramIndex += 1;
    }
    if (params.entityId !== undefined && params.entityId !== '') {
      conditions.push(`entity_id = $${paramIndex}`);
      values.push(params.entityId);
      paramIndex += 1;
    }
    if (params.traceId !== undefined && params.traceId !== '') {
      conditions.push(`trace_id = $${paramIndex}`);
      values.push(params.traceId);
      paramIndex += 1;
    }
    if (params.from !== undefined && params.from !== '') {
      conditions.push(`created_at >= $${paramIndex}::timestamptz`);
      values.push(params.from);
      paramIndex += 1;
    }
    if (params.to !== undefined && params.to !== '') {
      conditions.push(`created_at <= $${paramIndex}::timestamptz`);
      values.push(params.to);
      paramIndex += 1;
    }

    if (params.cursorDecoded) {
      const decoded = params.cursorDecoded;
      conditions.push(`(created_at, id) < ($${paramIndex}::timestamptz, $${paramIndex + 1}::uuid)`);
      values.push(decoded.createdAt, decoded.id);
      paramIndex += 2;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitParam = `$${paramIndex}`;
    values.push(limit + 1); // fetch one extra to know if there's a next page
    paramIndex += 1;

    const query = `
      SELECT id, created_at, actor_user_id, action, entity_type, entity_id, trace_id, meta
      FROM audit_log
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limitParam}
    `;

    const result = await this.pool.query<AuditRow>(query, values);
    const rows = result.rows;
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(rowToEntry);

    let nextCursor: string | undefined;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = encodeCursor(last.createdAt, last.id);
    }

    return { items, nextCursor };
  }

  async listActions(limitCount: number = 200): Promise<string[]> {
    if (!this.pool) {
      return [];
    }

    const result = await this.pool.query<{ action: string }>(
      `SELECT DISTINCT action FROM audit_log ORDER BY action ASC LIMIT $1`,
      [limitCount],
    );
    return result.rows.map((r) => r.action);
  }
}
