import { DecisionSchema } from './applications.dto';

describe('DecisionSchema', () => {
  it('accepts a rejection without notes', () => {
    expect(DecisionSchema.parse({ decision: 'reject' })).toEqual({
      decision: 'reject',
    });
  });

  it('accepts a rejection with optional notes', () => {
    expect(
      DecisionSchema.parse({
        decision: 'reject',
        notes: 'Does not meet quality guidelines',
      }),
    ).toEqual({
      decision: 'reject',
      notes: 'Does not meet quality guidelines',
    });
  });

  it('rejects notes on approve_invite', () => {
    const result = DecisionSchema.safeParse({
      decision: 'approve_invite',
      notes: 'Strong onboarding pitch',
    });
    expect(result.success).toBe(false);
  });

  it('accepts approve_invite without notes', () => {
    expect(DecisionSchema.parse({ decision: 'approve_invite' })).toEqual({
      decision: 'approve_invite',
    });
  });
});
