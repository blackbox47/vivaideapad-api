import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Concept } from '../concepts/concept.entity';
import {
  Submission,
  SubmissionStatus as BackendSubmissionStatus,
} from '../../contributor/entities/submission.entity';
import { AdminSubmissionsService } from '../submissions/admin-submissions.service';
import { ApiException } from '../../common/exceptions/api-exception';

/**
 * Wire-level shape returned by GET / PATCH /admin/review-queue.
 *
 * Matches the frontend's `ReviewQueueResponse` from
 * `vivaideapad-admin/src/models/content-review/content-review-model.ts:25-27`
 * 1:1 so the live UI renders without further transformation.
 *
 * `ContentSubmission` itself matches `content-review-model.ts:12-23`.
 */
export interface ReviewQueueResponse {
  submissions: ContentSubmission[];
}

export interface ContentSubmission {
  id: string;
  title: string;
  contributor: string;
  topic: string;
  submitted: string;
  risk: AiRisk;
  status: SubmissionStatus;
  body: string;
  approvedCount: number;
  approvalRate: string;
  /** Present when the contributor uploaded supporting evidence. */
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
  attachmentSize?: number | null;
}

export type SubmissionStatus =
  'Under Review' | 'Revision Requested' | 'Approved' | 'Published' | 'Rejected';

export type AiRisk = 'Low' | 'Medium' | 'High';

/** Shape the service accepts from the legacy PATCH body. */
export type LegacyDecideBody = {
  id: string;
  status: SubmissionStatus;
  comment?: string;
  reward_amount?: number;
};

@Injectable()
export class ReviewQueueService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissions: Repository<Submission>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Concept)
    private readonly concepts: Repository<Concept>,
    private readonly adminSubmissions: AdminSubmissionsService,
  ) {}

  /**
   * One-shot aggregate for the content-review page. Designed to be cheap:
   * 3 indexed queries (submissions + users + concepts) followed by two
   * GROUP BY queries for per-contributor approval metrics. No N+1.
   */
  async queue(): Promise<ReviewQueueResponse> {
    const rows = await this.submissions.find({
      where: { deletedAt: IsNull(), status: Not('draft') },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    if (rows.length === 0) return { submissions: [] };

    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    const conceptIds = Array.from(new Set(rows.map((r) => r.conceptId)));
    const [userRows, conceptRows] = await Promise.all([
      this.users.find({ where: userIds.map((id) => ({ id })) }),
      this.concepts.find({ where: conceptIds.map((id) => ({ id })) }),
    ]);
    const userById = new Map(userRows.map((u) => [u.id, u]));
    const conceptById = new Map(conceptRows.map((c) => [c.id, c]));

    const [approvalCounts, totalDecidedCounts] = await Promise.all([
      this.countByStatus(userIds, 'approved'),
      this.countByStatus(userIds, ['approved', 'rejected']),
    ]);

    const submissions: ContentSubmission[] = rows.map((s) => {
      const u = userById.get(s.userId);
      const c = conceptById.get(s.conceptId);
      const approved = approvalCounts.get(s.userId) ?? 0;
      const decided = totalDecidedCounts.get(s.userId) ?? 0;
      const attachments =
        s.attachments && typeof s.attachments === 'object'
          ? s.attachments
          : null;
      const attachmentUrl =
        typeof attachments?.url === 'string' ? attachments.url : null;
      return {
        id: s.id,
        title: s.title,
        contributor: u?.displayName ?? u?.email ?? s.userId,
        topic: c?.title ?? 'Untitled concept',
        submitted: s.createdAt.toISOString(),
        risk: deriveRisk(s.riskSignal),
        status: submissionStatusFor(s.status),
        body: s.body,
        approvedCount: approved,
        approvalRate: approvalRateFor(approved, decided),
        attachmentUrl,
        attachmentName:
          typeof attachments?.original_name === 'string'
            ? attachments.original_name
            : null,
        attachmentMimeType:
          typeof attachments?.mime_type === 'string'
            ? attachments.mime_type
            : null,
        attachmentSize:
          typeof attachments?.size === 'number' ? attachments.size : null,
      };
    });

    return { submissions };
  }

  /**
   * Legacy PATCH pipeline. Translates the SPA's wire-level
   * `{ id, status, comment }` body into the spec-aligned
   * `{ decision, notes }` shape and delegates to AdminSubmissionsService —
   * which performs the atomic flip + ledger entry + leaderboard upsert +
   * audit + notify transaction. Returns the refreshed queue so the SPA can
   * replace state in place without a follow-up GET.
   *
   * `'Published'` is intentionally rejected here: publication is a separate
   * `POST /admin/submissions/:id/publish` endpoint, not a decision.
   */
  async decide(
    actorId: string,
    body: LegacyDecideBody,
  ): Promise<ReviewQueueResponse> {
    if (body.status === 'Published') {
      throw ApiException.validation(
        'Use POST /admin/submissions/:id/publish to publish a submission',
      );
    }
    const decision = decisionForStatus(body.status);
    await this.adminSubmissions.decide({
      id: body.id,
      actorId,
      body: {
        decision,
        notes: body.comment,
        reward_amount: body.reward_amount,
      },
    });
    return this.queue();
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private async countByStatus(
    userIds: string[],
    statuses: BackendSubmissionStatus | BackendSubmissionStatus[],
  ): Promise<Map<string, number>> {
    const list = Array.isArray(statuses) ? statuses : [statuses];
    if (userIds.length === 0) return new Map();
    const rows = await this.submissions.manager.query<
      Array<{ user_id: string; cnt: string | number }>
    >(
      `SELECT user_id, COUNT(*) AS cnt
         FROM submissions
        WHERE user_id IN (?)
          AND status IN (?)
          AND deleted_at IS NULL
        GROUP BY user_id`,
      [userIds, list],
    );
    const out = new Map<string, number>();
    for (const r of rows) out.set(r.user_id, Number(r.cnt));
    return out;
  }
}

// =====================================================================
// Pure helpers — exported via __testing for unit tests.
// =====================================================================

/**
 * Map backend `Submission.status` (lowercase_snake) → frontend
 * `SubmissionStatus` (Title Case). Locked by review-queue.service.spec.ts.
 */
function submissionStatusFor(s: BackendSubmissionStatus): SubmissionStatus {
  switch (s) {
    case 'pending_review':
      return 'Under Review';
    case 'changes_requested':
      return 'Revision Requested';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'draft':
      // Drafts aren't surfaced by the review queue today, but if they ever
      // leak through (filter bug, race) the safe UI default is "Under Review".
      return 'Under Review';
  }
}

/**
 * Read `riskSignal.risk` from the submission's JSON column. Defaults to
 * 'Medium' when missing/unknown so the badge always renders a stable label.
 */
function deriveRisk(signal: Record<string, unknown> | null): AiRisk {
  if (!signal || typeof signal !== 'object') return 'Medium';
  const r = (signal as { risk?: unknown }).risk;
  if (r === 'Low' || r === 'Medium' || r === 'High') return r;
  return 'Medium';
}

/**
 * Format a contributor's approval rate as a percent string. `total` is the
 * count of decided (approved + rejected) submissions; 0 yields '0%' so
 * the badge never reads "NaN%".
 */
function approvalRateFor(approved: number, total: number): string {
  if (total <= 0) return '0%';
  const pct = Math.round((approved / total) * 100);
  return `${pct}%`;
}

/**
 * Translate the frontend wire status to the spec decision verb.
 * `Published` is filtered upstream — if it leaks here the switch falls
 * through to the validation branch.
 */
function decisionForStatus(
  status: SubmissionStatus,
): 'approve' | 'request_changes' | 'reject' {
  switch (status) {
    case 'Approved':
      return 'approve';
    case 'Revision Requested':
      return 'request_changes';
    case 'Rejected':
      return 'reject';
    case 'Under Review':
    case 'Published':
      throw ApiException.validation(
        `Cannot decide submission into status '${status}'`,
      );
  }
}

// Exported for unit tests (review-queue.service.spec.ts).
export const __testing = {
  submissionStatusFor,
  deriveRisk,
  approvalRateFor,
  decisionForStatus,
};
