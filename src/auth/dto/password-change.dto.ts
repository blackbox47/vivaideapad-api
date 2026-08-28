import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const PasswordChangeSchema = z.object({
  current_password: z.string().min(1),
  new_password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .max(128),
});

export class PasswordChangeDto extends createZodDto(PasswordChangeSchema) {}
export type PasswordChangeInput = z.infer<typeof PasswordChangeSchema>;
