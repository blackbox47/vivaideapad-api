import { __testing } from './applications.service';

const { toDetail } = __testing;

describe('toDetail', () => {
  const application = {
    id: '8680b75a-0d2a-45c3-93af-d8e88ccb717f',
    userId: 'user-1',
    categoryId: 'cat-1',
    ideaTitle: 'Crowd-sourced dead-zone map',
    ideaDescription: 'Riders pin weak-signal spots.',
    attachments: null,
    status: 'submitted',
    decisionNotes: null,
    decidedAt: null,
    decidedBy: null,
    referenceNumber: 'APP-20260911-ABCD',
    consent: 1,
    createdAt: new Date('2026-09-11T00:00:00.000Z'),
    updatedAt: new Date('2026-09-11T00:00:00.000Z'),
  };

  it('joins applicant and category fields the review panel needs', () => {
    const user = {
      id: 'user-1',
      displayName: 'Rafiqul Islam',
      email: 'rafiqul.islam@example.com',
    };
    const category = {
      id: 'cat-1',
      name: 'Network & Coverage',
    };

    const detail = toDetail(application as never, user as never, category as never);

    expect(detail.name).toBe('Rafiqul Islam');
    expect(detail.email).toBe('rafiqul.islam@example.com');
    expect(detail.topic).toBe('Network & Coverage');
    expect(detail.title).toBe('Crowd-sourced dead-zone map');
    expect(detail.body).toBe('Riders pin weak-signal spots.');
    expect(detail.submitted).toBe('2026-09-11T00:00:00.000Z');
    expect(detail.source).toBe('Website signup');
    expect(detail.consent).toBe(true);
    expect(detail.risk).toBe('High');
    expect(detail.concept).toBeNull();
  });

  it('uses the joined concept for topic title, brief, reward and close date', () => {
    const concept = {
      id: 'concept-1',
      categoryId: 'cat-1',
      title: 'Recharge reminder that feels personal',
      brief: 'Design a recharge nudge that feels helpful — not spammy — for prepaid users.',
      rewardBudget: '25000.00',
      status: 'active',
      closeDate: new Date('2026-10-25T00:00:00.000Z'),
      isOnboarding: true,
    };

    const detail = toDetail(
      application as never,
      { id: 'user-1', displayName: 'Rafiqul Islam', email: 'rafiqul.islam@example.com' } as never,
      { id: 'cat-1', name: 'Network & Coverage' } as never,
      concept as never,
    );

    expect(detail.topic).toBe('Recharge reminder that feels personal');
    expect(detail.concept?.title).toBe('Recharge reminder that feels personal');
    expect(detail.concept?.brief).toContain('recharge nudge');
    expect(detail.concept?.reward_budget).toBe('25000.00');
    expect(detail.concept?.close_date).toEqual(new Date('2026-10-25T00:00:00.000Z'));
  });

  it('falls back when user or category is missing', () => {
    const detail = toDetail(application as never, null, null);

    expect(detail.name).toBe('user-1');
    expect(detail.email).toBe('');
    expect(detail.topic).toBe('Uncategorized');
    expect(detail.user).toBeUndefined();
    expect(detail.category).toBeUndefined();
    expect(detail.concept).toBeNull();
    expect(detail.risk).toBe('High');
  });
});
