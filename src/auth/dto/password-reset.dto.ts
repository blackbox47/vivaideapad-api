import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const PasswordForgotSchema = z.object({
  email: z.string().trim().email().max(255),
});

export class PasswordForgotDto extends createZodDto(PasswordForgotSchema) {}

export const PasswordResetSchema = z.object({
  token: z.string().min(1).max(128),
  new_password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'password must contain at least one letter')
    .regex(/\d/, 'password must contain at least one number'),
});

export class PasswordResetDto extends createZodDto(PasswordResetSchema) {}
