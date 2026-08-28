import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import {
  ACCESS_STATUSES,
  isUserRole,
} from '../../../users/entities/user.entity';

export const AdminListQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});
export class AdminListQueryDto extends createZodDto(AdminListQuerySchema) {}

export const CreateAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  display_name: z.string().min(1).max(120).optional(),
});
export class CreateAdminDto extends createZodDto(CreateAdminSchema) {}

export const UpdateAdminSchema = z.object({
  display_name: z.string().min(1).max(120).optional(),
  role: z.coerce.number().int().refine(isUserRole, 'invalid role').optional(),
  access_status: z.enum(ACCESS_STATUSES).optional(),
  password: z.string().min(8).max(128).optional(),
});
export class UpdateAdminDto extends createZodDto(UpdateAdminSchema) {}

export const AdminIdParamSchema = z.object({ id: z.uuid() });
export class AdminIdParamDto extends createZodDto(AdminIdParamSchema) {}
