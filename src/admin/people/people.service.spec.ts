import { __testing } from './people.service';

/**
 * Locks the wire-level mappings between backend enums (ApplicationStatus,
 * users.access_status) and the frontend's PeopleResponse enums.
 *
 * If these tests fail after a backend refactor, the people-overview UI will
 * silently render the wrong status badge — fix it before merging.
 */

const { applicantStatusFor, platformStatusFor, formatTaka } = __testing;

describe('applicantStatusFor', () => {
  it.each([
    ['submitted', 'Under Review'],
    ['approved_invited', 'Approved'],
    ['rejected', 'Rejected'],
    ['needs_info', 'Revision Requested'],
    ['withdrawn', 'Rejected'],
  ] as const)('maps %s → %s', (input, expected) => {
    expect(applicantStatusFor(input)).toBe(expected);
  });
});

describe('platformStatusFor', () => {
  it.each([
    ['active', 'Active'],
    ['invited', 'Invited'],
    ['suspended', 'Suspended'],
    // Unknown values fall back to "Invited" — the safe UI default.
    ['unknown_future_state', 'Invited'],
    ['', 'Invited'],
  ] as const)('maps %s → %s', (input, expected) => {
    expect(platformStatusFor(input)).toBe(expected);
  });
});

describe('formatTaka', () => {
  it('formats whole taka with two decimals', () => {
    expect(formatTaka(0)).toBe('Tk 0.00');
    expect(formatTaka(100)).toBe('Tk 100.00');
  });

  it('preserves fractional cents', () => {
    expect(formatTaka(123.45)).toBe('Tk 123.45');
  });

  it('rounds to 2dp — no thousands separator (matches UI display)', () => {
    expect(formatTaka(1234.5)).toBe('Tk 1234.50');
    expect(formatTaka(100000)).toBe('Tk 100000.00');
  });
});
