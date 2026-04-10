import { z } from 'zod';

/**
 * Audit log entry V1 (admin read contract)
 * meta is always present; DB NULL is mapped to null.
 */
export interface AuditLogEntryV1 {
  id: string;
  createdAt: string;
  actorUserId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  traceId: string | null;
  meta: unknown | null;
}

/**
 * Zod schema for AuditLogEntryV1
 */
export const AuditLogEntryV1Schema = z.object({
  id: z.string(),
  createdAt: z.string(),
  actorUserId: z.string().nullable(),
  action: z.string(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  traceId: z.string().nullable(),
  meta: z.unknown().nullable(),
});

/**
 * List response for audit log (cursor-based pagination)
 */
export interface AuditLogListResponseV1 {
  items: AuditLogEntryV1[];
  nextCursor?: string;
}

/**
 * Zod schema for AuditLogListResponseV1
 */
export const AuditLogListResponseV1Schema = z.object({
  items: z.array(AuditLogEntryV1Schema),
  nextCursor: z.string().optional(),
});
