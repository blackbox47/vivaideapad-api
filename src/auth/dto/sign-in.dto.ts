import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export class SignInDto extends createZodDto(SignInSchema) {}
export type SignInInput = z.infer<typeof SignInSchema>;
