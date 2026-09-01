/**
 * Custom `passport-jwt` extractor that reads a JWT from a named cookie.
 *
 * `passport-jwt@4.x` does not ship a built-in cookie extractor, so we wire one
 * by hand using `fromExtractors`. Requires `cookie-parser` middleware to have
 * populated `req.cookies` upstream.
 */
import type { Request } from 'express';
import { ExtractJwt, type JwtFromRequestFunction } from 'passport-jwt';

export function fromCookie(cookieName: string): JwtFromRequestFunction {
  return (request: Request): string | null => {
    const raw = request.cookies?.[cookieName];
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  };
}

export function cookieExtractor(
  ...cookieNames: string[]
): JwtFromRequestFunction {
  return ExtractJwt.fromExtractors(cookieNames.map((name) => fromCookie(name)));
}
