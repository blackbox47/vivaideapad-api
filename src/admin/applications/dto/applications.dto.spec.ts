import {
  DecisionSchema,
  VerifyEmailApplicationCreateSchema,
  VerifyEmailTokenQuerySchema,
} from './applications.dto';

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

describe('VerifyEmailTokenQuerySchema', () => {
  it('requires a non-empty token', () => {
    expect(VerifyEmailTokenQuerySchema.parse({ token: 'abc' })).toEqual({
      token: 'abc',
    });
    expect(VerifyEmailTokenQuerySchema.safeParse({ token: '' }).success).toBe(
      false,
    );
  });
});

describe('VerifyEmailApplicationCreateSchema', () => {
  it('accepts a valid onboarding application body', () => {
    const valid = {
      token: 'tok-abc',
      concept_id: '11111111-1111-4111-8111-111111111111',
      idea_title: 'Coverage map',
      idea_summary: 'Short pitch',
      idea_description: '<p>Riders pin weak-signal spots on a shared map.</p>',
      consent: true,
    };
    expect(VerifyEmailApplicationCreateSchema.parse(valid)).toEqual(valid);
  });

  it('requires consent to be true', () => {
    expect(
      VerifyEmailApplicationCreateSchema.safeParse({
        token: 'tok-abc',
        concept_id: '11111111-1111-4111-8111-111111111111',
        idea_title: 'Coverage map',
        idea_description: 'Riders pin weak-signal spots on a shared map.',
        consent: false,
      }).success,
    ).toBe(false);
  });
});
