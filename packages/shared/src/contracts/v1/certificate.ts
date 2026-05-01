import { z } from 'zod';
import type { Id, IsoDateTime, UrlString } from './common.js';

/**
 * Готовый сертификат курса для студента: курс полностью пройден,
 * эксперт загрузил PDF. Карточка ведёт на предпросмотр PDF.
 */
export interface MyCertificateV1 {
  courseId: Id;
  courseTitle: string;
  /** Обложка курса для визуала карточки. */
  coverUrl?: UrlString | null;
  /** Имя/Фамилия автора курса (или null, если не задано). */
  authorDisplayName?: string | null;
  /** S3 ключ PDF (используется в `/files/signed`). */
  pdfKey: string;
  /** Имя файла, как загрузил эксперт (для скачивания). */
  pdfFilename?: string | null;
  /** Когда эксперт загрузил/обновил сертификат. */
  uploadedAt?: IsoDateTime | null;
  /** Когда студент завершил курс (последний `lesson_progress.completed_at`). */
  completedAt?: IsoDateTime | null;
}

export const MyCertificateV1Schema = z.object({
  courseId: z.string(),
  courseTitle: z.string(),
  coverUrl: z.string().nullable().optional(),
  authorDisplayName: z.string().nullable().optional(),
  pdfKey: z.string(),
  pdfFilename: z.string().nullable().optional(),
  uploadedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
});

export interface MyCertificatesResponseV1 {
  items: MyCertificateV1[];
}

export const MyCertificatesResponseV1Schema = z.object({
  items: z.array(MyCertificateV1Schema),
});
