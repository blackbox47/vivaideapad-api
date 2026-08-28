import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RefreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export class RefreshDto extends createZodDto(RefreshSchema) {}
export type RefreshInput = z.infer<typeof RefreshSchema>;
