import { getApiBaseUrl } from './env.js';

export type LegalDocumentKind = 'offer' | 'privacy' | 'personal_data';

/** Публичный PDF (API): GET без авторизации. */
export function legalDocumentPdfUrl(kind: LegalDocumentKind): string {
  const api = getApiBaseUrl().replace(/\/+$/, '');
  return `${api}/public/legal-documents/${encodeURIComponent(kind)}`;
}
