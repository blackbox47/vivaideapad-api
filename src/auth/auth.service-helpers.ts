/**
 * Tiny TTL parser shared between `AuthService.issueTokens` (for computing the
 * stored `RefreshToken.expiresAt` and `expires_in`) and `cookie-options.ts`
 * (for matching cookie `Max-Age` to the underlying JWT TTL).
 *
 * Supports "15m", "7d", "30s", "1h", or a bare number of seconds.
 */
export function parseTtl(ttl: string): Date {
  return new Date(Date.now() + parseTtlSeconds(ttl) * 1000);
}

export function parseTtlSeconds(ttl: string): number {
  const m = /^(\d+)([smhd])?$/.exec(ttl.trim());
  if (!m) return 900;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86400;
    default:
      return n;
  }
}
