import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { SUBMISSION_STATUSES } from '../entities/submission.entity';

export const SubmissionSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  concept_id: z.uuid(),
  concept_title: z.string().nullable().optional(),
  concept: z
    .object({
      id: z.string(),
      title: z.string(),
    })
    .nullable()
    .optional(),
  title: z.string(),
  body: z.string(),
  attachments: z.record(z.string(), z.unknown()).nullable(),
  status: z.enum(SUBMISSION_STATUSES),
  risk_signal: z.record(z.string(), z.unknown()).nullable(),
  reward_amount: z.string().nullable(),
  decision_notes: z.string().nullable(),
  decided_at: z.iso.datetime().nullable(),
  decided_by: z.uuid().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

export class SubmissionDto extends createZodDto(SubmissionSchema) {}

export const CreateSubmissionSchema = z.object({
  concept_id: z.uuid(),
  title: z.string().min(1).max(255),
  body: z.string().min(1).max(20_000),
  attachments: z
    .union([z.record(z.string(), z.unknown()), z.string()])
    .optional()
    .transform((val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val) as Record<string, unknown>;
        } catch {
          return { url: val };
        }
      }
      return val;
    }),
});
export class CreateSubmissionDto extends createZodDto(CreateSubmissionSchema) {}

export const UpdateSubmissionSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  body: z.string().min(1).max(20_000).optional(),
  attachments: z
    .union([z.record(z.string(), z.unknown()), z.string()])
    .optional()
    .transform((val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val) as Record<string, unknown>;
        } catch {
          return { url: val };
        }
      }
      return val;
    }),
});
export class UpdateSubmissionDto extends createZodDto(UpdateSubmissionSchema) {}

export const SubmissionListQuerySchema = z.object({
  status: z.enum(SUBMISSION_STATUSES).optional(),
  concept_id: z.uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});
export class SubmissionListQueryDto extends createZodDto(
  SubmissionListQuerySchema,
) {}

const IdParamSchema = z.object({ id: z.uuid() });
export class SubmissionIdParamDto extends createZodDto(IdParamSchema) {}
