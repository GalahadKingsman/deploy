import type { Pool } from 'pg';
import type { ContractsV1 } from '@tracked/shared';

const KINDS: ContractsV1.PlatformLegalDocKindV1[] = ['offer', 'privacy', 'personal_data'];

type Row = {
  doc_kind: string;
  storage_key: string;
  original_filename: string;
  uploaded_at: Date;
  uploaded_by_user_id: string | null;
};

function mapRow(r: Row): ContractsV1.AdminPlatformLegalDocumentV1 {
  return {
    kind: r.doc_kind as ContractsV1.PlatformLegalDocKindV1,
    uploaded: true,
    originalFilename: r.original_filename,
    uploadedAt: r.uploaded_at.toISOString(),
  };
}

export class PlatformLegalDocumentsRepository {
  constructor(private readonly pool: Pool | null) {}

  async list(): Promise<ContractsV1.AdminPlatformLegalDocumentV1[]> {
    const byKind = new Map<ContractsV1.PlatformLegalDocKindV1, ContractsV1.AdminPlatformLegalDocumentV1>();
    for (const k of KINDS) {
      byKind.set(k, { kind: k, uploaded: false, originalFilename: null, uploadedAt: null });
    }
    if (!this.pool) return KINDS.map((k) => byKind.get(k)!);
    const res = await this.pool.query<Row>(`SELECT doc_kind, storage_key, original_filename, uploaded_at, uploaded_by_user_id FROM platform_legal_documents`);
    for (const r of res.rows) {
      const k = r.doc_kind as ContractsV1.PlatformLegalDocKindV1;
      if (byKind.has(k)) byKind.set(k, mapRow(r));
    }
    return KINDS.map((k) => byKind.get(k)!);
  }

  async getRow(kind: ContractsV1.PlatformLegalDocKindV1): Promise<Row | null> {
    if (!this.pool) return null;
    const res = await this.pool.query<Row>(
      `SELECT doc_kind, storage_key, original_filename, uploaded_at, uploaded_by_user_id FROM platform_legal_documents WHERE doc_kind = $1`,
      [kind],
    );
    return res.rows[0] ?? null;
  }

  async upsert(params: {
    kind: ContractsV1.PlatformLegalDocKindV1;
    storageKey: string;
    originalFilename: string;
    uploadedByUserId: string | null;
  }): Promise<ContractsV1.AdminPlatformLegalDocumentV1> {
    if (!this.pool) {
      return {
        kind: params.kind,
        uploaded: true,
        originalFilename: params.originalFilename,
        uploadedAt: new Date().toISOString(),
      };
    }
    await this.pool.query(
      `
      INSERT INTO platform_legal_documents (doc_kind, storage_key, original_filename, uploaded_at, uploaded_by_user_id)
      VALUES ($1, $2, $3, now(), $4)
      ON CONFLICT (doc_kind) DO UPDATE SET
        storage_key = EXCLUDED.storage_key,
        original_filename = EXCLUDED.original_filename,
        uploaded_at = now(),
        uploaded_by_user_id = EXCLUDED.uploaded_by_user_id
      `,
      [params.kind, params.storageKey, params.originalFilename, params.uploadedByUserId],
    );
    const row = await this.getRow(params.kind);
    if (!row) {
      return {
        kind: params.kind,
        uploaded: true,
        originalFilename: params.originalFilename,
        uploadedAt: new Date().toISOString(),
      };
    }
    return mapRow(row);
  }

  async delete(kind: ContractsV1.PlatformLegalDocKindV1): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`DELETE FROM platform_legal_documents WHERE doc_kind = $1`, [kind]);
  }
}
