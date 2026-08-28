import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const AuditEventListQuerySchema = z.object({
  actor_id: z.uuid().optional(),
  target_type: z.string().optional(),
  target_id: z.uuid().optional(),
  action: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  date_from: z.iso.datetime().optional(),
  date_to: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});
export class AuditEventListQueryDto extends createZodDto(
  AuditEventListQuerySchema,
) {}

const IdParamSchema = z.object({ id: z.uuid() });
export class AuditEventIdParamDto extends createZodDto(IdParamSchema) {}
