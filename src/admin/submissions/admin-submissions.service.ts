import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import { ApiException } from '../../common/exceptions/api-exception';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Notification } from '../notifications/notification.entity';
import { WalletService } from '../../contributor/wallet.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import {
  Submission,
  SubmissionStatus,
} from '../../contributor/entities/submission.entity';
import { Concept } from '../concepts/concept.entity';
import {
  AdminSubmissionDecisionDto,
  RiskScanResultDto,
} from './dto/admin-submissions.dto';

export interface SerializedAdminSubmission {
  id: string;
  user_id: string;
  concept_id: string;
  title: string;
  body: string;
  attachments: Record<string, unknown> | null;
  status: SubmissionStatus;
  risk_signal: Record<string, unknown> | null;
  reward_amount: string | null;
  decision_notes: string | null;
  decided_at: Date | null;
  decided_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const toSerialized = (s: Submission): SerializedAdminSubmission => ({
  id: s.id,
  user_id: s.userId,
  concept_id: s.conceptId,
  title: s.title,
  body: s.body,
  attachments: s.attachments,
  status: s.status,
  risk_signal: s.riskSignal,
  reward_amount: s.rewardAmount,
  decision_notes: s.decisionNotes,
  decided_at: s.decidedAt,
  decided_by: s.decidedBy,
  created_at: s.createdAt,
  updated_at: s.updatedAt,
});

@Injectable()
export class AdminSubmissionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Submission)
    private readonly repo: Repository<Submission>,
    private readonly audit: AuditEventsService,
    private readonly notify: NotificationsService,
    private readonly wallet: WalletService,
    private readonly leaderboard: LeaderboardService,
  ) {}

  async list(input: {
    status?: SubmissionStatus;
    user_id?: string;
    concept_id?: string;
    page: number;
    limit: number;
  }): Promise<{ data: SerializedAdminSubmission[]; total: number }> {
    const qb = this.repo.createQueryBuilder('s').where('s.deleted_at IS NULL');
    if (input.status) qb.andWhere('s.status = :st', { st: input.status });
    if (input.user_id) qb.andWhere('s.user_id = :uid', { uid: input.user_id });
    if (input.concept_id)
      qb.andWhere('s.concept_id = :cid', { cid: input.concept_id });
    qb.orderBy('s.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map(toSerialized), total };
  }

  async findOne(id: string): Promise<SerializedAdminSubmission> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Submission');
    return toSerialized(found);
  }

  async decide(input: {
    id: string;
    actorId: string;
    body: AdminSubmissionDecisionDto;
  }): Promise<SerializedAdminSubmission> {
    const { id, actorId, body } = input;

    let savedNotification: Notification | null = null;

    const result = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Submission);
      const found = await repo.findOne({
        where: { id, deletedAt: IsNull() },
      });
      if (!found) throw ApiException.notFound('Submission');
      if (found.status !== 'pending_review') {
        throw ApiException.businessRule(
          'invalid_state',
          `Cannot decide submission in status ${found.status}`,
        );
      }

      let nextStatus: SubmissionStatus;
      let effectiveReward = body.reward_amount;
      switch (body.decision) {
        case 'approve':
          if (!effectiveReward || effectiveReward <= 0) {
            const conceptRepo = manager.getRepository(Concept);
            const concept = await conceptRepo.findOne({
              where: { id: found.conceptId, deletedAt: IsNull() },
            });
            const conceptBudget = concept ? Number(concept.rewardBudget) : 0;
            if (conceptBudget > 0) {
              effectiveReward = conceptBudget;
            }
          }
          if (!effectiveReward || effectiveReward <= 0) {
            throw ApiException.validation(
              'reward_amount is required and must be > 0 when approving',
            );
          }
          nextStatus = 'approved';
          break;
        case 'reject':
          nextStatus = 'rejected';
          break;
        case 'request_changes':
          nextStatus = 'changes_requested';
          break;
        default:
          throw ApiException.validation('Unknown decision');
      }

      found.status = nextStatus;
      found.decisionNotes = body.notes ?? null;
      found.decidedAt = new Date();
      found.decidedBy = actorId;
      if (body.decision === 'approve' && effectiveReward) {
        found.rewardAmount = effectiveReward.toFixed(2);
      }
      const saved = await repo.save(found);

      // Atomic side-effects: reward_credit ledger + leaderboard upsert.
      if (
        body.decision === 'approve' &&
        effectiveReward &&
        effectiveReward > 0
      ) {
        await this.wallet.recordInTx(manager, {
          userId: found.userId,
          type: 'reward_credit',
          amount: effectiveReward.toFixed(2),
          status: 'posted',
          reference: `submission:${found.id}`,
          metadata: { submission_id: found.id, title: found.title },
        });
        await this.leaderboard.incrementInTx(manager, {
          userId: found.userId,
          period: 'all_time',
          scoreDelta: effectiveReward.toFixed(2),
          approvalIncrement: 1,
        });
      }

      await this.audit.record(manager, {
        actorId,
        action: `submission.${body.decision}`,
        targetType: 'submission',
        targetId: found.id,
        category: 'submissions',
        context: {
          previous_status: 'pending_review',
          new_status: nextStatus,
          reward_amount: effectiveReward ?? null,
          notes: body.notes ?? null,
        },
      });

      savedNotification = await this.notify.emit(manager, {
        recipientId: found.userId,
        type:
          body.decision === 'request_changes'
            ? 'submission_request_revision'
            : 'submission_decision',
        title: titleForSubmissionDecision(body.decision, effectiveReward),
        body: body.notes ?? undefined,
        linkedRecordType: 'submission',
        linkedRecordId: found.id,
        payload: {
          decision: body.decision,
          status: nextStatus,
          reward_amount: effectiveReward ?? null,
        },
      });

      return toSerialized(saved);
    });

    if (savedNotification) {
      this.notify.publishCreated(savedNotification);
    }
    return result;
  }

  async riskScan(input: {
    id: string;
    actorId: string;
  }): Promise<RiskScanResultDto> {
    const found = await this.repo.findOne({
      where: { id: input.id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Submission');

    // No-op per the locked decision: deterministic empty result.
    const signal = { score: 0, flags: [] as string[], summary: 'clean' };
    await this.repo.update({ id: found.id }, { riskSignal: signal });

    await this.audit.recordStandalone({
      actorId: input.actorId,
      action: 'submission.risk_scan',
      targetType: 'submission',
      targetId: found.id,
      category: 'submissions',
      context: { signal },
    });

    return signal;
  }

  async softDelete(id: string): Promise<void> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Submission');
    await this.repo.softRemove(found);
  }
}

function titleForSubmissionDecision(
  decision: 'approve' | 'reject' | 'request_changes',
  rewardAmount?: number,
): string {
  switch (decision) {
    case 'approve':
      return `Approved — ৳${rewardAmount ?? 0} reward credited to your wallet`;
    case 'reject':
      return 'Your submission was not accepted';
    case 'request_changes':
      return 'Changes requested on your submission';
  }
}
