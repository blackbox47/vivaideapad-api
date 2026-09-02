import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SignInSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export class SignInDto extends createZodDto(SignInSchema) {}
export type SignInInput = z.infer<typeof SignInSchema>;
