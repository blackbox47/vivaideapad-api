import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import {
  ACCESS_STATUSES,
  isUserRole,
} from '../../../users/entities/user.entity';

export const AdminUserListQuerySchema = z.object({
  role: z.coerce.number().int().refine(isUserRole, 'invalid role').optional(),
  access_status: z.enum(ACCESS_STATUSES).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});
export class AdminUserListQueryDto extends createZodDto(
  AdminUserListQuerySchema,
) {}

export const UpdateAccessStatusSchema = z.object({
  access_status: z.enum(ACCESS_STATUSES),
  reason: z.string().max(500).optional(),
});
export class UpdateAccessStatusDto extends createZodDto(
  UpdateAccessStatusSchema,
) {}

export const UpdateRoleSchema = z.object({
  role: z.coerce.number().int().refine(isUserRole, 'invalid role'),
  reason: z.string().max(500).optional(),
});
export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}

const IdParamSchema = z.object({ id: z.uuid() });
export class AdminUserIdParamDto extends createZodDto(IdParamSchema) {}
