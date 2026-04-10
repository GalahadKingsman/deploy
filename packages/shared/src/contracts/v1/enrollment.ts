import { z } from 'zod';
import type { Id, IsoDateTime } from './common.js';

export interface EnrollmentV1 {
  id: Id;
  userId: Id;
  courseId: Id;
  accessEnd?: IsoDateTime | null;
  revokedAt?: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export const EnrollmentV1Schema = z.object({
  id: z.string(),
  userId: z.string(),
  courseId: z.string(),
  accessEnd: z.string().nullable().optional(),
  revokedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Expert «Доступ»: строка списка с Telegram ученика */
export interface ExpertEnrollmentRowV1 {
  enrollment: EnrollmentV1;
  studentTelegramUserId: string;
  studentUsername: string | null;
}

export interface ListExpertCourseEnrollmentsResponseV1 {
  items: ExpertEnrollmentRowV1[];
}

export interface ExtendEnrollmentRequestV1 {
  grantDays: number;
}

export const ExtendEnrollmentRequestV1Schema = z.object({
  grantDays: z.number().int().min(1).max(3650),
});

export const ExpertEnrollmentRowV1Schema = z.object({
  enrollment: EnrollmentV1Schema,
  studentTelegramUserId: z.string().min(1),
  studentUsername: z.string().nullable(),
});

export const ListExpertCourseEnrollmentsResponseV1Schema = z.object({
  items: z.array(ExpertEnrollmentRowV1Schema),
});

