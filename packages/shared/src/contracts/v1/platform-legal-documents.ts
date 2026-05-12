import { z } from 'zod';

export type PlatformLegalDocKindV1 = 'offer' | 'privacy' | 'personal_data';

export const PlatformLegalDocKindV1Schema = z.enum(['offer', 'privacy', 'personal_data']);

export interface AdminPlatformLegalDocumentV1 {
  kind: PlatformLegalDocKindV1;
  uploaded: boolean;
  originalFilename: string | null;
  uploadedAt: string | null;
}

export const AdminPlatformLegalDocumentV1Schema = z.object({
  kind: PlatformLegalDocKindV1Schema,
  uploaded: z.boolean(),
  originalFilename: z.string().nullable(),
  uploadedAt: z.string().nullable(),
});

export interface ListAdminPlatformLegalDocumentsResponseV1 {
  items: AdminPlatformLegalDocumentV1[];
}

export const ListAdminPlatformLegalDocumentsResponseV1Schema = z.object({
  items: z.array(AdminPlatformLegalDocumentV1Schema),
});

export interface UploadAdminPlatformLegalDocumentResponseV1 {
  ok: true;
  document: AdminPlatformLegalDocumentV1;
}

export const UploadAdminPlatformLegalDocumentResponseV1Schema = z.object({
  ok: z.literal(true),
  document: AdminPlatformLegalDocumentV1Schema,
});

export interface DeleteAdminPlatformLegalDocumentResponseV1 {
  ok: true;
  document: AdminPlatformLegalDocumentV1;
}

export const DeleteAdminPlatformLegalDocumentResponseV1Schema = z.object({
  ok: z.literal(true),
  document: AdminPlatformLegalDocumentV1Schema,
});
