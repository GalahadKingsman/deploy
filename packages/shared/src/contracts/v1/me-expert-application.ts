import { z } from 'zod';
import type { ExpertApplicationV1 } from './expert-application.js';
import { ExpertApplicationV1Schema } from './expert-application.js';

/**
 * Me Expert Application response V1 (Story 5.6)
 * GET /me/expert-application, POST /me/expert-application
 */
export interface MeExpertApplicationResponseV1 {
  application: ExpertApplicationV1 | null;
}

export const MeExpertApplicationResponseV1Schema = z.object({
  application: ExpertApplicationV1Schema.nullable(),
});
