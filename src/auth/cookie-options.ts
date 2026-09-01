/**
 * Single source of truth for cookie attributes.
 *
 * - `buildCookieOptions` is the canonical option set for HttpOnly credentials
 *   (access + refresh). `Max-Age` is derived from `parseTtlSeconds(JWT_*_TTL)`
 *   so cookies cannot outlive the underlying JWT.
 * - `buildSessionHintOptions` is the non-HttpOnly variant used for the
 *   `vivaideapad.session` hint cookie — it stays JS-readable on purpose so the
 *   SPA can render role-aware UI on bootstrap without a network round-trip.
 * - `setAuthCookies` / `clearAuthCookies` are the only entry points the
 *   controller uses to attach / detach cookies on auth endpoints.
 */
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

import { parseTtlSeconds } from './auth.service-helpers';

export function buildCookieOptions(
  cfg: ConfigService,
  kind: 'access' | 'refresh',
): CookieOptions {
  const ttlField = kind === 'access' ? 'JWT_ACCESS_TTL' : 'JWT_REFRESH_TTL';
  const ttlSeconds = parseTtlSeconds(cfg.get<string>(ttlField) ?? '15m');
  return {
    httpOnly: true,
    secure: cfg.get<boolean>('cookie.secure') ?? false,
    sameSite: cfg.get<'lax' | 'strict'>('cookie.sameSite') ?? 'lax',
    domain: cfg.get<string>('cookie.domain') || undefined,
    path: '/',
    maxAge: ttlSeconds * 1000,
  };
}

export function buildSessionHintOptions(cfg: ConfigService): CookieOptions {
  // Lifetime tracks the refresh cookie — a stale hint is harmless because the
  // real credentials are the HttpOnly pair, not the hint.
  const refreshTtlSeconds = parseTtlSeconds(
    cfg.get<string>('JWT_REFRESH_TTL') ?? '7d',
  );
  return {
    httpOnly: false,
    secure: cfg.get<boolean>('cookie.secure') ?? false,
    sameSite: cfg.get<'lax' | 'strict'>('cookie.sameSite') ?? 'lax',
    domain: cfg.get<string>('cookie.domain') || undefined,
    path: '/',
    maxAge: refreshTtlSeconds * 1000,
  };
}

export function setAuthCookies(
  res: Response,
  cfg: ConfigService,
  payload: {
    accessToken: string;
    refreshToken: string;
    user: { id: string; role: number };
  },
): void {
  const accessName =
    cfg.get<string>('cookie.accessName') ?? 'vivaideapad.access';
  const refreshName =
    cfg.get<string>('cookie.refreshName') ?? 'vivaideapad.refresh';
  const sessionName =
    cfg.get<string>('cookie.sessionName') ?? 'vivaideapad.session';

  res.cookie(
    accessName,
    payload.accessToken,
    buildCookieOptions(cfg, 'access'),
  );
  res.cookie(
    refreshName,
    payload.refreshToken,
    buildCookieOptions(cfg, 'refresh'),
  );
  const refreshTtlSeconds = parseTtlSeconds(
    cfg.get<string>('JWT_REFRESH_TTL') ?? '7d',
  );
  const hint = Buffer.from(
    JSON.stringify({
      uid: payload.user.id,
      role: payload.user.role,
      exp: Date.now() + refreshTtlSeconds * 1000,
    }),
  ).toString('base64url');
  res.cookie(sessionName, hint, buildSessionHintOptions(cfg));
}

export function clearAuthCookies(res: Response, cfg: ConfigService): void {
  const opts = {
    path: '/',
    domain: cfg.get<string>('cookie.domain') || undefined,
  };
  for (const name of [
    cfg.get<string>('cookie.accessName') ?? 'vivaideapad.access',
    cfg.get<string>('cookie.refreshName') ?? 'vivaideapad.refresh',
    cfg.get<string>('cookie.sessionName') ?? 'vivaideapad.session',
  ]) {
    res.clearCookie(name, opts);
  }
}
