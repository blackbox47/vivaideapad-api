import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { ACCESS_STATUSES } from '../entities/user.entity';

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.string().email(),
  display_name: z.string().nullable(),
  bio: z.string().nullable(),
  avatar_url: z.string().nullable(),
  role: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  access_status: z.enum(ACCESS_STATUSES),
  display_prefs: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

export class UserDto extends createZodDto(UserSchema) {}

export const UpdateProfileSchema = z.object({
  display_name: z
    .string()
    .min(1)
    .max(30, 'Display name must be at most 30 characters.')
    .optional(),
  bio: z.string().max(2000).optional(),
  avatar_url: z.string().url().max(512).optional(),
});

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}

export const UpdateDisplayPrefsSchema = z.object({
  display_prefs: z.record(z.string(), z.unknown()),
});

export class UpdateDisplayPrefsDto extends createZodDto(
  UpdateDisplayPrefsSchema,
) {}
