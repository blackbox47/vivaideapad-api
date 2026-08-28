import { registerAs } from '@nestjs/config';

/**
 * Typed namespaces for ConfigService.get('namespace.field') lookups.
 *
 * Each factory's return type is also exposed as the matching `<X>ConfigShape`
 * interface so consumers can derive a precise type instead of repeating
 * `string | undefined`. Use `ConfigType<typeof factory>` from `@nestjs/config`
 * when you need the whole namespace as an injected object.
 */

export interface AppConfigShape {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
}

export interface JwtConfigShape {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
}

export interface UploadsConfigShape {
  dir: string;
  maxBytes: number;
  publicPrefix: string;
}

export const APP_CONFIG = 'app';
export const JWT_CONFIG = 'jwt';
export const UPLOADS_CONFIG = 'uploads';

export const appConfig = registerAs<AppConfigShape>(APP_CONFIG, () => ({
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: (process.env.NODE_ENV ?? 'development') as AppConfigShape['nodeEnv'],
}));

export const jwtConfig = registerAs<JwtConfigShape>(JWT_CONFIG, () => ({
  // No defaults — secrets must be supplied. Boot-time validation in
  // env.schema.ts is the single source of truth for required values.
  accessSecret: process.env.JWT_ACCESS_SECRET as string,
  refreshSecret: process.env.JWT_REFRESH_SECRET as string,
  accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
}));

export const uploadsConfig = registerAs<UploadsConfigShape>(
  UPLOADS_CONFIG,
  () => ({
    dir: process.env.UPLOAD_DIR ?? './uploads',
    maxBytes: Number(process.env.UPLOAD_MAX_BYTES ?? 10_485_760),
    publicPrefix: process.env.UPLOAD_PUBLIC_PREFIX ?? '/api/v1/uploads/files',
  }),
);
