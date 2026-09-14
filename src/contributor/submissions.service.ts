import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';

import { ApiException } from '../common/exceptions/api-exception';
import { NotificationsService } from '../admin/notifications/notifications.service';
import { User, USER_ROLES } from '../users/entities/user.entity';
import { Submission, SubmissionStatus } from './entities/submission.entity';
import { Concept } from '../admin/concepts/concept.entity';
import {
  CreateSubmissionDto,
  normalizeAttachments,
  UpdateSubmissionDto,
} from './dto/submissions.dto';

export interface SerializedSubmission {
  id: string;
  user_id: string;
  concept_id: string;
  concept_title?: string | null;
  concept?: {
    id: string;
    title: string;
  } | null;
  title: string;
  summary: string | null;
  body: string;
  attachments: Record<string, unknown>[] | Record<string, unknown> | null;
  status: SubmissionStatus;
  risk_signal: Record<string, unknown> | null;
  reward_amount: string | null;
  decision_notes: string | null;
  revision_window_days: number | null;
  revision_due_at: Date | null;
  decided_at: Date | null;
  decided_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const toSerialized = (
  s: Submission,
  conceptTitle?: string | null,
): SerializedSubmission => ({
  id: s.id,
  user_id: s.userId,
  concept_id: s.conceptId,
  concept_title: conceptTitle ?? null,
  concept: s.conceptId
    ? {
        id: s.conceptId,
        title: conceptTitle ?? '',
      }
    : null,
  title: s.title,
  summary: s.summary,
  body: s.body,
  attachments: s.attachments,
  status: s.status,
  risk_signal: s.riskSignal,
  reward_amount: s.rewardAmount,
  decision_notes: s.decisionNotes,
  revision_window_days: s.revisionWindowDays,
  revision_due_at: s.revisionDueAt,
  decided_at: s.decidedAt,
  decided_by: s.decidedBy,
  created_at: s.createdAt,
  updated_at: s.updatedAt,
});

function normalizeSummary(value?: string): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Submission)
    private readonly repo: Repository<Submission>,
    @InjectRepository(Concept)
    private readonly conceptRepo: Repository<Concept>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async list(input: {
    userId: string;
    status?: SubmissionStatus;
    concept_id?: string;
    search?: string;
    page: number;
    limit: number;
  }): Promise<{ data: SerializedSubmission[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.deleted_at IS NULL')
      .andWhere('s.user_id = :uid', { uid: input.userId });
    if (input.status) qb.andWhere('s.status = :st', { st: input.status });
    if (input.concept_id)
      qb.andWhere('s.concept_id = :cid', { cid: input.concept_id });
    if (input.search) {
      qb.andWhere('(s.title LIKE :q OR s.body LIKE :q)', {
        q: `%${input.search}%`,
      });
    }
    qb.orderBy('s.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [rows, total] = await qb.getManyAndCount();

    if (rows.length === 0) return { data: [], total };

    const conceptIds = Array.from(
      new Set(rows.map((r) => r.conceptId).filter(Boolean)),
    );
    const conceptRows =
      conceptIds.length > 0
        ? await this.conceptRepo.find({
            where: conceptIds.map((id) => ({ id })),
            withDeleted: true,
          })
        : [];
    const conceptById = new Map(conceptRows.map((c) => [c.id, c.title]));

    return {
      data: rows.map((r) => toSerialized(r, conceptById.get(r.conceptId))),
      total,
    };
  }

  async findOneForUser(
    id: string,
    userId: string,
  ): Promise<SerializedSubmission> {
    const found = await this.repo.findOne({
      where: { id, userId, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Submission');
    const concept = found.conceptId
      ? await this.conceptRepo.findOne({
          where: { id: found.conceptId },
          withDeleted: true,
        })
      : null;
    return toSerialized(found, concept?.title);
  }

  async create(
    userId: string,
    input: CreateSubmissionDto,
  ): Promise<SerializedSubmission> {
    const attachments = normalizeAttachments(input.attachments);

    // Reject duplicate submissions on the same topic for the same contributor.
    // A contributor may only have one active (non-soft-deleted) submission
    // per concept; they should edit or delete the existing one instead.
    const existing = await this.repo.findOne({
      where: {
        userId,
        conceptId: input.concept_id,
        deletedAt: IsNull(),
      },
    });
    if (existing) {
      throw ApiException.conflict(
        'already_submitted',
        'You already have an idea for this topic. Edit your existing submission instead.',
      );
    }

    const row = this.repo.create({
      userId,
      conceptId: input.concept_id,
      title: input.title,
      summary: normalizeSummary(input.summary),
      body: input.body,
      attachments: attachments.length > 0 ? attachments : null,
      status: 'draft',
    });
    const saved = await this.repo.save(row);
    const concept = saved.conceptId
      ? await this.conceptRepo.findOne({ where: { id: saved.conceptId } })
      : null;
    return toSerialized(saved, concept?.title);
  }

  async update(
    id: string,
    userId: string,
    patch: UpdateSubmissionDto,
  ): Promise<SerializedSubmission> {
    const found = await this.repo.findOne({
      where: { id, userId, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Submission');
    if (found.status !== 'draft' && found.status !== 'changes_requested') {
      throw ApiException.businessRule(
        'invalid_state',
        `Submission cannot be edited in status ${found.status}`,
      );
    }
    if (patch.concept_id !== undefined) found.conceptId = patch.concept_id;
    if (patch.title !== undefined) found.title = patch.title;
    if (patch.summary !== undefined)
      found.summary = normalizeSummary(patch.summary);
    if (patch.body !== undefined) found.body = patch.body;
    if (patch.attachments !== undefined) {
      const attachments = normalizeAttachments(patch.attachments);
      found.attachments = attachments.length > 0 ? attachments : null;
    }
    const saved = await this.repo.save(found);
    const concept = saved.conceptId
      ? await this.conceptRepo.findOne({ where: { id: saved.conceptId } })
      : null;
    return toSerialized(saved, concept?.title);
  }

  async submit(id: string, userId: string): Promise<SerializedSubmission> {
    const found = await this.repo.findOne({
      where: { id, userId, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Submission');
    if (found.status !== 'draft' && found.status !== 'changes_requested') {
      throw ApiException.businessRule(
        'invalid_state',
        `Submission cannot be submitted in status ${found.status}`,
      );
    }
    found.status = 'pending_review';
    const saved = await this.repo.save(found);
    const concept = saved.conceptId
      ? await this.conceptRepo.findOne({ where: { id: saved.conceptId } })
      : null;

    // Notify all active admins about the new submission.
    void this.notifyAdminsOfSubmission(saved, concept?.title ?? null);

    return toSerialized(saved, concept?.title);
  }

  /**
   * Send a `submission_submitted` notification to every active admin
   * and superadmin. Fire-and-forget — submission success does not depend
   * on notification delivery.
   */
  private async notifyAdminsOfSubmission(
    submission: Submission,
    conceptTitle: string | null,
  ): Promise<void> {
    try {
      const admins = await this.userRepo.find({
        where: {
          role: In([USER_ROLES.ADMINISTRATOR, USER_ROLES.SUPERADMIN]),
          deletedAt: IsNull(),
        },
        select: ['id'],
      });

      const title = `New idea submitted: ${submission.title}`;
      const body = submission.summary
        ? submission.summary.slice(0, 200)
        : conceptTitle
          ? `A new submission for "${conceptTitle}" is ready for review.`
          : 'A new submission is ready for review.';

      await Promise.all(
        admins.map((admin) =>
          this.notificationsService.emitStandalone({
            recipientId: admin.id,
            type: 'submission_submitted',
            title,
            body,
            linkedRecordType: 'submission',
            linkedRecordId: submission.id,
            payload: {
              submission_id: submission.id,
              concept_id: submission.conceptId,
              contributor_id: submission.userId,
            },
          }),
        ),
      );
    } catch {
      // Notification failure should never block the submission flow.
    }
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const found = await this.repo.findOne({
      where: { id, userId, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Submission');
    if (found.status !== 'draft') {
      throw ApiException.businessRule(
        'invalid_state',
        'Only draft submissions can be deleted',
      );
    }
    await this.repo.softRemove(found);
  }
}
