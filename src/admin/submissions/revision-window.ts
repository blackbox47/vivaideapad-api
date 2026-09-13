import { z } from 'zod';

export const REVISION_WINDOW_DAYS = [3, 7, 14] as const;
export type RevisionWindowDays = (typeof REVISION_WINDOW_DAYS)[number];
export const DEFAULT_REVISION_WINDOW_DAYS: RevisionWindowDays = 7;

export const RevisionWindowDaysSchema = z.coerce
  .number()
  .int()
  .refine(
    (n): n is RevisionWindowDays => n === 3 || n === 7 || n === 14,
    { message: 'revision_window_days must be 3, 7, or 14' },
  );

export function isRevisionWindowDays(n: number): n is RevisionWindowDays {
  return n === 3 || n === 7 || n === 14;
}

export function revisionDueAt(
  days: RevisionWindowDays,
  from = new Date(),
): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function resolveRevisionWindow(
  decision: 'approve' | 'reject' | 'request_changes',
  days?: number,
  from = new Date(),
): {
  revisionWindowDays: RevisionWindowDays | null;
  revisionDueAt: Date | null;
} {
  if (decision !== 'request_changes') {
    return { revisionWindowDays: null, revisionDueAt: null };
  }
  const windowDays: RevisionWindowDays =
    days !== undefined && isRevisionWindowDays(days)
      ? days
      : DEFAULT_REVISION_WINDOW_DAYS;
  return {
    revisionWindowDays: windowDays,
    revisionDueAt: revisionDueAt(windowDays, from),
  };
}
