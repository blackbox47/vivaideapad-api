import { AdminSubmissionDecisionSchema } from './admin-submissions.dto';

describe('AdminSubmissionDecisionSchema', () => {
  it('accepts a rejection without notes', () => {
    expect(AdminSubmissionDecisionSchema.parse({ decision: 'reject' })).toEqual(
      { decision: 'reject' },
    );
  });

  it('accepts a rejection with optional notes', () => {
    expect(
      AdminSubmissionDecisionSchema.parse({
        decision: 'reject',
        notes: 'Needs a clearer KPI section',
      }),
    ).toEqual({
      decision: 'reject',
      notes: 'Needs a clearer KPI section',
    });
  });
});
