import { z } from 'zod';

/**
 * Boot-time environment validation. Wired into ConfigModule.forRoot({ validate })
 * so a missing or malformed env var fails fast with one consolidated error
 * instead of crashing the first strategy/service that happens to read it.
 *
 * Keep this file as the single source of truth for required values. The typed
 * factories in app.config.ts read directly from `process.env` because they run
 * before ConfigModule exposes its API — the Zod check here guarantees those
 * reads are safe.
 */
export const EnvSchema = z.object({
  // Runtime
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // MySQL
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3307),
  DB_USERNAME: z.string().min(1).default('vivaidea'),
  DB_PASSWORD: z.string().min(1).default('vivaidea'),
  DB_NAME: z.string().min(1).default('vivaidea'),
  DB_SYNCHRONIZE: z
    .union([z.literal('true'), z.literal('false')])
    .default('false'),

  // JWT — no defaults. Missing secrets are a deployment error, not a fallback.
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  // Uploads
  UPLOAD_DIR: z.string().min(1).default('./uploads'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10_485_760),
  UPLOAD_PUBLIC_PREFIX: z.string().min(1).default('/api/v1/uploads/files'),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function validateEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    // Surface a clear, single error rather than the verbose default.
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
