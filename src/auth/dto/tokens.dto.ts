import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { UserSchema } from '../../users/dto/user.dto';

export const AuthUserSchema = z.object({
  id: z.uuid(),
  email: z.string().email(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable().optional(),
  role: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  access_status: z.enum(['active', 'invited', 'suspended', 'pending_review']),
});

export const TokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.literal('Bearer'),
  expires_in: z.number().int().positive(),
  user: AuthUserSchema,
});

export class TokensDto extends createZodDto(TokensSchema) {}
export type Tokens = z.infer<typeof TokensSchema>;

// Use this to silence unused-import warnings during incremental refactors.
export type _UnusedUserSchema = z.infer<typeof UserSchema>;
