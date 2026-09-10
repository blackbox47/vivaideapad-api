import { Not, Repository } from 'typeorm';
import { ReviewQueueService, __testing } from './review-queue.service';
import { Submission } from '../../contributor/entities/submission.entity';
import { User } from '../../users/entities/user.entity';
import { Concept } from '../concepts/concept.entity';
import { AdminSubmissionsService } from '../submissions/admin-submissions.service';

/**
 * Locks the wire-level mappings between backend enums (Submission.status)
 * and the frontend's ReviewQueueResponse shape used by the SPA's content-
 * review page. If these tests fail after a backend refactor, the
 * content-review UI will silently render the wrong status / risk / approval
 * rate — fix it before merging.
 */

const { submissionStatusFor, deriveRisk, approvalRateFor, decisionForStatus } =
  __testing;

describe('ReviewQueueService', () => {
  it('queries submissions excluding draft status', async () => {
    const submissionsFind = jest.fn().mockResolvedValue([]);
    const submissionsRepo = {
      find: submissionsFind,
    } as unknown as Repository<Submission>;
    const usersRepo = { find: jest.fn() } as unknown as Repository<User>;
    const conceptsRepo = { find: jest.fn() } as unknown as Repository<Concept>;
    const adminSubmissions = {} as AdminSubmissionsService;

    const service = new ReviewQueueService(
      submissionsRepo,
      usersRepo,
      conceptsRepo,
      adminSubmissions,
    );

    const result = await service.queue();

    expect(result).toEqual({ submissions: [] });
    expect(submissionsFind).toHaveBeenCalledTimes(1);
    const findArgs = submissionsFind.mock.calls[0] as [
      { where?: { status?: unknown } } | undefined,
    ];
    expect(findArgs[0]?.where?.status).toEqual(Not('draft'));
  });

  it('forwards decision, comment and reward_amount to adminSubmissions.decide', async () => {
    const decideMock = jest.fn().mockResolvedValue({});
    const submissionsRepo = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as Repository<Submission>;
    const usersRepo = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as Repository<User>;
    const conceptsRepo = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as Repository<Concept>;
    const adminSubmissions = {
      decide: decideMock,
    } as unknown as AdminSubmissionsService;

    const service = new ReviewQueueService(
      submissionsRepo,
      usersRepo,
      conceptsRepo,
      adminSubmissions,
    );

    await service.decide('admin-user-id', {
      id: '1bd42d11-2ae1-44e0-a409-2313bd6a0497',
      status: 'Approved',
      comment: 'Looks great',
      reward_amount: 500,
    });

    expect(decideMock).toHaveBeenCalledWith({
      id: '1bd42d11-2ae1-44e0-a409-2313bd6a0497',
      actorId: 'admin-user-id',
      body: {
        decision: 'approve',
        notes: 'Looks great',
        reward_amount: 500,
      },
    });
  });
});

describe('submissionStatusFor', () => {
  it.each([
    ['pending_review', 'Under Review'],
    ['changes_requested', 'Revision Requested'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['draft', 'Under Review'],
  ] as const)('maps %s → %s', (input, expected) => {
    expect(submissionStatusFor(input)).toBe(expected);
  });
});

describe('deriveRisk', () => {
  it.each([
    [{ risk: 'Low' }, 'Low'],
    [{ risk: 'Medium' }, 'Medium'],
    [{ risk: 'High' }, 'High'],
  ] as const)('returns the stored risk when it is %s', (input, expected) => {
    expect(deriveRisk(input as unknown as Record<string, unknown>)).toBe(
      expected,
    );
  });

  it('defaults to Medium when the column is null', () => {
    expect(deriveRisk(null)).toBe('Medium');
  });

  it('defaults to Medium when the column is missing the risk field', () => {
    expect(deriveRisk({})).toBe('Medium');
  });

  it('defaults to Medium for an unrecognised risk value', () => {
    expect(deriveRisk({ risk: 'Critical' })).toBe('Medium');
    expect(deriveRisk({ risk: 'low' as unknown as 'Low' })).toBe('Medium');
  });
});

describe('approvalRateFor', () => {
  it('returns 0% when the contributor has no decided submissions', () => {
    expect(approvalRateFor(0, 0)).toBe('0%');
  });

  it('returns 100% when everything was approved', () => {
    expect(approvalRateFor(5, 5)).toBe('100%');
  });

  it('rounds to the nearest whole percent', () => {
    expect(approvalRateFor(2, 3)).toBe('67%');
    expect(approvalRateFor(1, 3)).toBe('33%');
    expect(approvalRateFor(1, 6)).toBe('17%');
    expect(approvalRateFor(5, 6)).toBe('83%');
  });

  it('treats negative totals as zero (defensive)', () => {
    expect(approvalRateFor(0, -1)).toBe('0%');
  });
});

describe('decisionForStatus', () => {
  it.each([
    ['Approved', 'approve'],
    ['Revision Requested', 'request_changes'],
    ['Rejected', 'reject'],
  ] as const)('maps %s → %s', (input, expected) => {
    expect(decisionForStatus(input)).toBe(expected);
  });

  it('rejects Published — publication is a separate endpoint', () => {
    let caught: unknown;
    try {
      decisionForStatus('Published');
    } catch (e) {
      caught = e;
    }
    // ApiException extends HttpException; the user-facing message is on
    // response.error.message (the spec-aligned envelope), not the JS message.
    const response = (
      caught as { getResponse?: () => unknown }
    )?.getResponse?.();
    const message =
      typeof response === 'object' && response !== null && 'error' in response
        ? (response as { error: { message?: string } }).error.message
        : String(caught);
    expect(message).toMatch(/publish/i);
  });

  it('rejects Under Review as a terminal decision target', () => {
    expect(() => decisionForStatus('Under Review')).toThrow();
  });
});
