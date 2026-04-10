import { Injectable, Optional, Inject } from '@nestjs/common';
import { Pool } from 'pg';

export interface AuditEntry {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  meta: Record<string, unknown> | null;
  traceId: string | null;
}

/**
 * Minimal audit writer for ban enforcement (EPIC 4 will extend).
 */
@Injectable()
export class AuditService {
  constructor(@Optional() @Inject(Pool) private readonly pool: Pool | null) {}

  async write(entry: AuditEntry): Promise<void> {
    if (!this.pool) return;

    try {
      await this.pool.query(
        `
        INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, meta, trace_id)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)
        `,
        [
          entry.actorUserId ?? null,
          entry.action,
          entry.entityType,
          entry.entityId,
          entry.meta ? JSON.stringify(entry.meta) : null,
          entry.traceId ?? null,
        ],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('AuditService.write failed:', msg);
      // In test env, rethrow so RBAC tests fail when audit write fails (must-use same DB)
      const strict = process.env.NODE_ENV === 'test' || process.env.AUDIT_STRICT === '1';
      if (strict) {
        throw err;
      }
    }
  }
}
