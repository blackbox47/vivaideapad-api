import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { CONCEPT_STATUSES } from '../concept.entity';

export const ConceptSchema = z.object({
  id: z.uuid(),
  category_id: z.uuid(),
  title: z.string(),
  brief: z.string(),
  reward_budget: z.string(),
  is_onboarding: z.boolean().default(false),
  status: z.enum(CONCEPT_STATUSES),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  open_date: z.iso.datetime().nullable(),
  close_date: z.iso.datetime().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

export class ConceptDto extends createZodDto(ConceptSchema) {}

export const CreateConceptSchema = z.object({
  category_id: z.uuid(),
  title: z.string().min(1).max(255),
  brief: z.string().min(1).max(10_000),
  reward_budget: z.coerce.number().nonnegative().default(0),
  is_onboarding: z.boolean().default(false).optional(),
  status: z.enum(CONCEPT_STATUSES).default('draft'),
  metadata: z.record(z.string(), z.unknown()).optional(),
  open_date: z.iso.datetime().nullable().optional(),
  close_date: z.iso.datetime().nullable().optional(),
});

export class CreateConceptDto extends createZodDto(CreateConceptSchema) {}

export const UpdateConceptSchema = CreateConceptSchema.partial();
export class UpdateConceptDto extends createZodDto(UpdateConceptSchema) {}

export const ConceptListQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(CONCEPT_STATUSES).optional(),
  category_id: z.uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});

export class ConceptListQueryDto extends createZodDto(ConceptListQuerySchema) {}

export const ConceptIdParamSchema = z.object({
  id: z.uuid({ message: 'id must be a UUID' }),
});
export class ConceptIdParamDto extends createZodDto(ConceptIdParamSchema) {}

export const BULK_CONCEPT_ACTIONS = [
  'set_status',
  'set_for_new_users',
  'set_is_onboarding',
  'remove_is_onboarding',
  'duplicate',
  'delete',
] as const;
export type BulkConceptActionType = (typeof BULK_CONCEPT_ACTIONS)[number];

export const BulkConceptActionSchema = z.object({
  action: z.enum(BULK_CONCEPT_ACTIONS),
  ids: z
    .array(z.uuid({ message: 'Each id must be a UUID' }))
    .min(1, 'At least one id is required'),
  status: z.enum(CONCEPT_STATUSES).optional(),
  for_new_users: z.boolean().optional(),
  is_onboarding: z.boolean().optional(),
});
export class BulkConceptActionDto extends createZodDto(
  BulkConceptActionSchema,
) {}
