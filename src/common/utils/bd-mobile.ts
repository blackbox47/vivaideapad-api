/**
 * Bangladeshi mobile numbers are 11 digits starting with 013–019.
 * Also accepts +880 / 880 country-code prefixes and common separators.
 */
const BD_LOCAL_MOBILE = /^01[3-9]\d{8}$/;

export function normalizeBdMobileInput(value: string): string {
  return value
    .trim()
    .replace(/[\s\-()]/g, '')
    .replace(/^\+/, '');
}

export function toBdLocalMobile(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const digits = normalizeBdMobileInput(value);
  const local = digits.startsWith('88') ? digits.slice(2) : digits;
  return BD_LOCAL_MOBILE.test(local) ? local : null;
}
