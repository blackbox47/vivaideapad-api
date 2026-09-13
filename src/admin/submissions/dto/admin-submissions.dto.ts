import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { SUBMISSION_STATUSES } from '../../../contributor/entities/submission.entity';
import { RevisionWindowDaysSchema } from '../revision-window';

export const AdminSubmissionDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject', 'request_changes']),
  reward_amount: z.coerce.number().positive().optional(),
  notes: z.string().max(2000).optional(),
  revision_window_days: RevisionWindowDaysSchema.optional(),
});
export class AdminSubmissionDecisionDto extends createZodDto(
  AdminSubmissionDecisionSchema,
) {}

export const RiskScanResultSchema = z.object({
  score: z.number(),
  flags: z.array(z.string()),
  summary: z.string(),
});
export class RiskScanResultDto extends createZodDto(RiskScanResultSchema) {}

export const AdminSubmissionListQuerySchema = z.object({
  status: z.enum(SUBMISSION_STATUSES).optional(),
  user_id: z.uuid().optional(),
  concept_id: z.uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});
export class AdminSubmissionListQueryDto extends createZodDto(
  AdminSubmissionListQuerySchema,
) {}

const IdParamSchema = z.object({ id: z.uuid() });
export class AdminSubmissionIdParamDto extends createZodDto(IdParamSchema) {}
