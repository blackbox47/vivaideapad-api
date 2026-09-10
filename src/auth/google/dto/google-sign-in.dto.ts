import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const GoogleSignInSchema = z.object({
  credential: z.string().min(1, 'Google credential token is required'),
});

export class GoogleSignInDto extends createZodDto(GoogleSignInSchema) {}
export type GoogleSignInInput = z.infer<typeof GoogleSignInSchema>;
