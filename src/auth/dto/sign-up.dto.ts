import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { isUserRole } from '../../users/entities/user.entity';

export const SignUpSchema = z.object({
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .max(128),
  displayName: z.string().min(1).max(120).optional(),
  role: z.coerce.number().int().refine(isUserRole, 'invalid role').optional(),
});

export class SignUpDto extends createZodDto(SignUpSchema) {}
export type SignUpInput = z.infer<typeof SignUpSchema>;
