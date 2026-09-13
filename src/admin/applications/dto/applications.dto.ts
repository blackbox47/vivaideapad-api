import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { APPLICATION_STATUSES } from '../application.entity';

export const ApplicationSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  category_id: z.uuid(),
  idea_title: z.string(),
  idea_description: z.string(),
  attachments: z.record(z.string(), z.unknown()).nullable(),
  status: z.enum(APPLICATION_STATUSES),
  decision_notes: z.string().nullable(),
  decided_at: z.iso.datetime().nullable(),
  decided_by: z.uuid().nullable(),
  reference_number: z.string().nullable(),
  consent: z.boolean(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

export class ApplicationDto extends createZodDto(ApplicationSchema) {}

export const PublicApplicationCreateSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1).max(120),
  phone: z.string().max(40).optional(),
  category_id: z.uuid(),
  idea_title: z.string().min(1).max(255),
  idea_description: z.string().min(1).max(5000),
  consent: z.boolean().refine((v) => v === true, 'Consent is required'),
});
export class PublicCreateApplicationDto extends createZodDto(
  PublicApplicationCreateSchema,
) {}

export const DecisionSchema = z.object({
  decision: z.enum(['approve_invite', 'reject', 'request_more_info']),
  notes: z.string().max(2000).optional(),
});
export class ApplicationDecisionDto extends createZodDto(DecisionSchema) {}

export const ApplicationListQuerySchema = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
  user_id: z.uuid().optional(),
  category_id: z.uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});
export class ApplicationListQueryDto extends createZodDto(
  ApplicationListQuerySchema,
) {}

const IdParamSchema = z.object({ id: z.uuid() });
export class ApplicationIdParamDto extends createZodDto(IdParamSchema) {}

/**
 * Legacy PATCH /admin/applicants body used by the people-overview SPA.
 * The spec-aligned path is POST /admin/applications/:id/decision.
 */
export const LegacyApplicationDecisionSchema = z.object({
  id: z.uuid(),
  status: z.string().min(1),
  comment: z.string().max(2000).optional(),
});
export class LegacyApplicationDecisionDto extends createZodDto(
  LegacyApplicationDecisionSchema,
) {}

export const LegacyApplicationDecisionByIdSchema = z.object({
  status: z.string().min(1),
  comment: z.string().max(2000).optional(),
});
export class LegacyApplicationDecisionByIdDto extends createZodDto(
  LegacyApplicationDecisionByIdSchema,
) {}
