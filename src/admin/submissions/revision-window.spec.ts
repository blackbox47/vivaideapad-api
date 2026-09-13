import {
  DEFAULT_REVISION_WINDOW_DAYS,
  RevisionWindowDaysSchema,
  resolveRevisionWindow,
  revisionDueAt,
} from './revision-window';

describe('revisionDueAt', () => {
  it('adds an exact number of 24-hour days', () => {
    const from = new Date('2026-09-13T12:00:00.000Z');
    expect(revisionDueAt(3, from).toISOString()).toBe(
      '2026-09-16T12:00:00.000Z',
    );
    expect(revisionDueAt(7, from).toISOString()).toBe(
      '2026-09-20T12:00:00.000Z',
    );
    expect(revisionDueAt(14, from).toISOString()).toBe(
      '2026-09-27T12:00:00.000Z',
    );
  });
});

describe('resolveRevisionWindow', () => {
  const from = new Date('2026-09-13T12:00:00.000Z');

  it('defaults request_changes to the 7-day standard window', () => {
    const result = resolveRevisionWindow('request_changes', undefined, from);
    expect(result.revisionWindowDays).toBe(DEFAULT_REVISION_WINDOW_DAYS);
    expect(result.revisionDueAt?.toISOString()).toBe(
      '2026-09-20T12:00:00.000Z',
    );
  });

  it.each([3, 7, 14] as const)(
    'stores a %s-day window on request_changes',
    (days) => {
      const result = resolveRevisionWindow('request_changes', days, from);
      expect(result.revisionWindowDays).toBe(days);
      expect(result.revisionDueAt).toEqual(revisionDueAt(days, from));
    },
  );

  it.each(['approve', 'reject'] as const)(
    'clears the window on %s',
    (decision) => {
      expect(resolveRevisionWindow(decision, 14, from)).toEqual({
        revisionWindowDays: null,
        revisionDueAt: null,
      });
    },
  );

  it('falls back to the standard window for an out-of-band day count', () => {
    const result = resolveRevisionWindow('request_changes', 5, from);
    expect(result.revisionWindowDays).toBe(7);
  });
});

describe('RevisionWindowDaysSchema', () => {
  it.each([3, 7, 14, '3', '7', '14'])('accepts %s', (value) => {
    expect(RevisionWindowDaysSchema.parse(value)).toBe(Number(value));
  });

  it.each([1, 5, 10, 0, -7, 1.5])('rejects %s', (value) => {
    expect(RevisionWindowDaysSchema.safeParse(value).success).toBe(false);
  });
});
