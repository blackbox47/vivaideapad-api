import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { ApiException } from '../../common/exceptions/api-exception';
import { Concept } from './concept.entity';
import {
  Submission,
  SubmissionStatus,
} from '../../contributor/entities/submission.entity';
import {
  AuditEventsService,
  RecordAuditInput,
} from '../audit-events/audit-events.service';
import { AuditEvent } from '../audit-events/audit-event.entity';
import { BulkConceptDeleteResult, ConceptsService } from './concepts.service';

/**
 * Pure helper for asserting that the soft-delete cascade only touches
 * submissions whose status is in the `CASCADE_STATUSES` set. Anything
 * approved/rejected/etc must be left alone.
 */
function expectedIds(submissions: Submission[]): string[] {
  return submissions
    .filter((s) => s.status === 'pending_review' && s.deletedAt === null)
    .map((s) => s.id);
}

function makeConcept(overrides: Partial<Concept> = {}): Concept {
  const c = new Concept();
  c.id = overrides.id ?? 'concept-1';
  c.categoryId = overrides.categoryId ?? 'cat-1';
  c.title = overrides.title ?? 'Network nudge';
  c.brief = overrides.brief ?? 'brief';
  c.rewardBudget = overrides.rewardBudget ?? '100.00';
  c.isOnboarding = overrides.isOnboarding ?? false;
  c.status = overrides.status ?? 'active';
  c.metadata = overrides.metadata ?? null;
  c.openDate = overrides.openDate ?? null;
  c.closeDate = overrides.closeDate ?? null;
  c.createdAt = overrides.createdAt ?? new Date('2026-09-01T00:00:00.000Z');
  c.updatedAt = overrides.updatedAt ?? new Date('2026-09-01T00:00:00.000Z');
  c.deletedAt = overrides.deletedAt ?? null;
  return c;
}

function makeSubmission(
  overrides: Partial<Submission> & { status: SubmissionStatus },
): Submission {
  const s = new Submission();
  s.id = overrides.id ?? 'sub-1';
  s.userId = overrides.userId ?? 'user-1';
  s.conceptId = overrides.conceptId ?? 'concept-1';
  s.title = overrides.title ?? 'pitch';
  s.summary = overrides.summary ?? null;
  s.body = overrides.body ?? 'body';
  s.attachments = overrides.attachments ?? null;
  s.status = overrides.status;
  s.riskSignal = overrides.riskSignal ?? null;
  s.rewardAmount = overrides.rewardAmount ?? null;
  s.decisionNotes = overrides.decisionNotes ?? null;
  s.revisionWindowDays = overrides.revisionWindowDays ?? null;
  s.revisionDueAt = overrides.revisionDueAt ?? null;
  s.decidedAt = overrides.decidedAt ?? null;
  s.decidedBy = overrides.decidedBy ?? null;
  s.createdAt = overrides.createdAt ?? new Date('2026-09-01T00:00:00.000Z');
  s.updatedAt = overrides.updatedAt ?? new Date('2026-09-01T00:00:00.000Z');
  s.deletedAt = overrides.deletedAt ?? null;
  return s;
}

describe('ConceptsService cascade delete', () => {
  let service: ConceptsService;
  let conceptRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    softRemove: jest.Mock;
  };
  let submissionRepo: {
    find: jest.Mock;
    softRemove: jest.Mock;
    count: jest.Mock;
  };
  let audit: {
    record: jest.Mock<Promise<AuditEvent>, [EntityManager, RecordAuditInput]>;
  };
  let dataSource: {
    transaction: jest.Mock;
  };

  // We capture the transactional callback so we can invoke it with a fake
  // manager that wires the mocked repos and audit spy.
  let lastTxCallback: ((manager: unknown) => Promise<unknown>) | undefined;
  let tx: jest.Mock;

  beforeEach(async () => {
    conceptRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      softRemove: jest.fn((rows: Concept[]) => Promise.resolve(rows)),
    };
    submissionRepo = {
      find: jest.fn(),
      softRemove: jest.fn((rows: Submission[]) => Promise.resolve(rows)),
      count: jest.fn().mockResolvedValue(0),
    };
    audit = {
      record: jest.fn<Promise<AuditEvent>, [EntityManager, RecordAuditInput]>(
        () => Promise.resolve({} as AuditEvent),
      ),
    };
    tx = jest.fn(async (cb: (manager: unknown) => Promise<unknown>) => {
      lastTxCallback = cb;
      const manager = {
        getRepository: (entity: unknown) => {
          if (entity === Concept) return conceptRepo;
          if (entity === Submission) return submissionRepo;
          throw new Error(`Unexpected entity in test: ${String(entity)}`);
        },
      };
      return cb(manager);
    });
    dataSource = { transaction: tx };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConceptsService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(Concept), useValue: conceptRepo },
        { provide: getRepositoryToken(Submission), useValue: submissionRepo },
        { provide: AuditEventsService, useValue: audit },
      ],
    }).compile();

    service = module.get(ConceptsService);
    lastTxCallback = undefined;
  });

  it('cascades to both pending_review submissions and records the audit event', async () => {
    const concept = makeConcept({ id: 'c-1' });
    const subs = [
      makeSubmission({ id: 's-1', status: 'pending_review' }),
      makeSubmission({ id: 's-2', status: 'pending_review' }),
    ];
    conceptRepo.findOne.mockResolvedValue(concept);
    submissionRepo.find.mockResolvedValue(subs);

    const result = await service.softDelete({ id: 'c-1', actorId: 'admin-1' });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(conceptRepo.softRemove).toHaveBeenCalledWith(concept);
    expect(submissionRepo.softRemove).toHaveBeenCalledWith(subs);
    expect(audit.record).toHaveBeenCalledTimes(1);
    const call = audit.record.mock.calls[0][1];
    expect(call.action).toBe('concept.delete');
    expect(call.targetType).toBe('concept');
    expect(call.targetId).toBe('c-1');
    expect(call.category).toBe('concepts');
    expect(call.context).toMatchObject({
      cascaded_submission_ids: ['s-1', 's-2'],
      cascaded_submission_count: 2,
      cascading_statuses: ['pending_review'],
    });

    expect(result).toEqual({
      id: 'c-1',
      cascaded_submissions: 2,
      cascaded_submission_ids: ['s-1', 's-2'],
    });
    expect(lastTxCallback).toBeDefined();
  });

  it('does not touch approved submissions, but still records an empty cascade', async () => {
    const concept = makeConcept({ id: 'c-2' });
    const subs = [
      makeSubmission({ id: 's-3', status: 'approved' }),
      makeSubmission({ id: 's-4', status: 'rejected' }),
    ];
    conceptRepo.findOne.mockResolvedValue(concept);
    submissionRepo.find.mockResolvedValue([]); // only pending_review returned

    const result = await service.softDelete({ id: 'c-2', actorId: 'admin-1' });

    expect(submissionRepo.softRemove).not.toHaveBeenCalled();
    expect(conceptRepo.softRemove).toHaveBeenCalledWith(concept);
    expect(audit.record.mock.calls[0][1].context).toMatchObject({
      cascaded_submission_ids: [],
      cascaded_submission_count: 0,
    });
    expect(result.cascaded_submissions).toBe(0);
    // Sanity: the helper used by the service should agree with our expectations.
    expect(expectedIds(subs)).toEqual([]);
  });

  it('handles a topic with no submissions cleanly', async () => {
    const concept = makeConcept({ id: 'c-3' });
    conceptRepo.findOne.mockResolvedValue(concept);
    submissionRepo.find.mockResolvedValue([]);

    const result = await service.softDelete({ id: 'c-3', actorId: 'admin-1' });

    expect(conceptRepo.softRemove).toHaveBeenCalledWith(concept);
    expect(submissionRepo.softRemove).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(result.cascaded_submissions).toBe(0);
  });

  it('throws not-found when the topic does not exist', async () => {
    conceptRepo.findOne.mockResolvedValue(null);

    await expect(
      service.softDelete({ id: 'missing', actorId: 'admin-1' }),
    ).rejects.toBeInstanceOf(ApiException);
    expect(conceptRepo.softRemove).not.toHaveBeenCalled();
    expect(submissionRepo.softRemove).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  describe('bulkAction delete', () => {
    it('aggregates cascade counts across multiple topics in one transaction', async () => {
      const rows = [makeConcept({ id: 'c-a' }), makeConcept({ id: 'c-b' })];
      conceptRepo.find.mockResolvedValue(rows);

      // For each concept, return a different number of pending_review rows.
      submissionRepo.find.mockImplementation(
        (input: { where: { conceptId: string; status: unknown } }) => {
          const cid = input.where.conceptId;
          if (cid === 'c-a') {
            return Promise.resolve([
              makeSubmission({
                id: 'sub-a1',
                conceptId: 'c-a',
                status: 'pending_review',
              }),
              makeSubmission({
                id: 'sub-a2',
                conceptId: 'c-a',
                status: 'pending_review',
              }),
            ]);
          }
          if (cid === 'c-b') {
            return Promise.resolve([
              makeSubmission({
                id: 'sub-b1',
                conceptId: 'c-b',
                status: 'pending_review',
              }),
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const result = await service.bulkAction(
        {
          action: 'delete',
          ids: ['c-a', 'c-b'],
        },
        'admin-1',
      );

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(conceptRepo.softRemove).toHaveBeenCalledWith(rows);
      // Cascaded ids are aggregated across the batch.
      expect(submissionRepo.softRemove).toHaveBeenCalledTimes(2);
      // One audit event per concept.
      expect(audit.record).toHaveBeenCalledTimes(2);
      const actions = audit.record.mock.calls.map((call) => call[1].action);
      expect(actions).toEqual(['concept.bulk_delete', 'concept.bulk_delete']);

      expect(result).toMatchObject({
        success: true,
        affected: 2,
        cascaded_submissions: 3,
      });
      expect(
        (result as BulkConceptDeleteResult).cascaded_submission_ids
          .slice()
          .sort(),
      ).toEqual(['sub-a1', 'sub-a2', 'sub-b1']);
    });

    it('rejects bulk delete without an actor id', async () => {
      await expect(
        service.bulkAction({ action: 'delete', ids: ['c-x'] }),
      ).rejects.toBeInstanceOf(ApiException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('previewCascade', () => {
    it('returns 0 when given empty ids', async () => {
      const result = await service.previewCascade([]);
      expect(result).toEqual({ cascaded_submissions: 0 });
      expect(submissionRepo.count).not.toHaveBeenCalled();
    });

    it('queries submissionRepo for pending_review count across given concept ids', async () => {
      submissionRepo.count.mockResolvedValue(4);
      const result = await service.previewCascade(['c-1', 'c-2']);
      expect(submissionRepo.count).toHaveBeenCalled();
      expect(result).toEqual({ cascaded_submissions: 4 });
    });
  });
});
