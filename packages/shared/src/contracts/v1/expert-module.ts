import { z } from 'zod';
import type { Id, IsoDateTime } from './common.js';

export interface ExpertCourseModuleV1 {
  id: Id;
  courseId: Id;
  title: string;
  position: number;
  deletedAt?: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export const ExpertCourseModuleV1Schema = z.object({
  id: z.string(),
  courseId: z.string(),
  title: z.string(),
  position: z.number(),
  deletedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export interface ListExpertCourseModulesResponseV1 {
  items: ExpertCourseModuleV1[];
}

export const ListExpertCourseModulesResponseV1Schema = z.object({
  items: z.array(ExpertCourseModuleV1Schema),
});

export interface CreateExpertCourseModuleRequestV1 {
  title: string;
}

export const CreateExpertCourseModuleRequestV1Schema = z.object({
  title: z.string().min(1),
});

export interface UpdateExpertCourseModuleRequestV1 {
  title?: string;
}

export const UpdateExpertCourseModuleRequestV1Schema = z.object({
  title: z.string().min(1).optional(),
});

export interface ReorderExpertCourseModulesRequestV1 {
  items: { id: Id; position: number }[];
}

export const ReorderExpertCourseModulesRequestV1Schema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      position: z.number().int().min(0),
    }),
  ),
});

