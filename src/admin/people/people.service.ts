import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { User, USER_ROLES, UserRole } from '../../users/entities/user.entity';
import {
  Application,
  ApplicationStatus,
} from '../applications/application.entity';
import { Category } from '../categories/category.entity';

/**
 * Shape returned by GET /admin/people. Matches the frontend's
 * `PeopleResponse` type (vivaideapad-admin/src/models/people/people-model.ts)
 * 1:1 so the live UI renders without further transformation.
 *
 * `applicants` is denormalized for the table — it carries the category name
 * (topic) and the human-readable application fields the table expects.
 *
 * `users` carries contributor accounts with the metrics the table displays
 * (approved submission count, accumulated payout balance). Admins and
 * superadmins are excluded — they're managed under /admin/admins.
 */
export interface PeopleResponse {
  applicants: ApplicantView[];
  users: PlatformUserView[];
}

export interface ApplicantView {
  id: string;
  name: string;
  email: string;
  topic: string;
  title: string;
  body: string;
  submitted: string;
  status: ApplicantStatus;
}

export type ApplicantStatus =
  'Submitted' | 'Under Review' | 'Revision Requested' | 'Approved' | 'Rejected';

export interface PlatformUserView {
  id: string;
  name: string;
  email: string;
  status: PlatformUserStatus;
  approved: number;
  balance: string;
  joined: string;
  hasLiveSubmission: boolean;
  invitedFrom: string;
}

export type PlatformUserStatus = 'Active' | 'Invited' | 'Suspended';

@Injectable()
export class PeopleService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Application)
    private readonly applications: Repository<Application>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  /**
   * One-shot aggregate. Designed for the people-overview page that wants both
   * tabs' data in a single round-trip. Performance: 3 indexed queries,
   * N+1-safe (single in-memory join for the category topic lookup).
   */
  async snapshot(): Promise<PeopleResponse> {
    const [applicants, users] = await Promise.all([
      this.loadApplicants(),
      this.loadPlatformUsers(),
    ]);
    return { applicants, users };
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private async loadApplicants(): Promise<ApplicantView[]> {
    const rows = await this.applications.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    if (rows.length === 0) return [];

    // Fetch the joined data in two indexed queries instead of N+1 joins.
    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    const categoryIds = Array.from(new Set(rows.map((r) => r.categoryId)));
    const [userRows, categoryRows] = await Promise.all([
      this.users.find({ where: userIds.map((id) => ({ id })) }),
      this.categories.find({ where: categoryIds.map((id) => ({ id })) }),
    ]);
    const userById = new Map(userRows.map((u) => [u.id, u]));
    const categoryById = new Map(categoryRows.map((c) => [c.id, c]));

    return rows.map((a) => {
      const u = userById.get(a.userId);
      const cat = categoryById.get(a.categoryId);
      return {
        id: a.id,
        name: u?.displayName ?? u?.email ?? a.userId,
        email: u?.email ?? '',
        topic: cat?.name ?? 'Uncategorized',
        title: a.ideaTitle,
        body: a.ideaDescription,
        submitted: a.createdAt.toISOString(),
        status: applicantStatusFor(a.status),
      };
    });
  }

  private async loadPlatformUsers(): Promise<PlatformUserView[]> {
    const contributorRole: UserRole = USER_ROLES.CONTRIBUTOR;
    const rows = await this.users.find({
      where: { role: contributorRole, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    if (rows.length === 0) return [];

    // Pull application-derived metrics for the visible users.
    const userIds = rows.map((r) => r.id);
    const [applicationCounts, payoutSums, liveSubmissionFlags] =
      await Promise.all([
        this.countApprovedApplications(userIds),
        this.sumPaidOut(userIds),
        this.liveSubmissionFlags(userIds),
      ]);

    return rows.map((u) => ({
      id: u.id,
      name: u.displayName ?? u.email,
      email: u.email,
      status: platformStatusFor(u.accessStatus),
      approved: applicationCounts.get(u.id) ?? 0,
      balance: payoutSums.get(u.id) ?? 'Tk 0',
      joined: u.createdAt.toISOString().slice(0, 10),
      hasLiveSubmission: liveSubmissionFlags.get(u.id) ?? false,
      invitedFrom: '', // No tracking table yet — surfaced as empty until then.
    }));
  }

  private async countApprovedApplications(
    userIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.applications
      .createQueryBuilder('a')
      .select('a.user_id', 'user_id')
      .addSelect('COUNT(*)', 'cnt')
      .where('a.user_id IN (:...ids)', { ids: userIds })
      .andWhere('a.status = :s', { s: 'approved_invited' })
      .andWhere('a.deleted_at IS NULL')
      .groupBy('a.user_id')
      .getRawMany<{ user_id: string; cnt: string | number }>();
    const out = new Map<string, number>();
    for (const r of rows) {
      out.set(r.user_id, Number(r.cnt));
    }
    return out;
  }

  /**
   * Sum paid-out payouts per user. Returns a "Tk NNN.NN" string formatted to
   * match the live UI's display. If a user has no payouts, defaults to "Tk 0".
   */
  private async sumPaidOut(userIds: string[]): Promise<Map<string, string>> {
    // Payout table is owned by the payouts module; we use raw SQL to avoid
    // dragging that module's repository into this aggregate service.
    const rows = await this.applications.manager.query<
      Array<{ user_id: string; total: string | number | null }>
    >(
      `SELECT p.user_id, COALESCE(SUM(p.amount), 0) AS total
         FROM payout_requests p
        WHERE p.user_id IN (?)
          AND p.status = 'paid'
          AND p.deleted_at IS NULL
        GROUP BY p.user_id`,
      [userIds],
    );
    const out = new Map<string, string>();
    for (const r of rows) {
      out.set(r.user_id, formatTaka(Number(r.total ?? 0)));
    }
    return out;
  }

  private async liveSubmissionFlags(
    userIds: string[],
  ): Promise<Map<string, boolean>> {
    const rows = await this.applications.manager.query<
      Array<{ user_id: string }>
    >(
      `SELECT DISTINCT s.user_id
         FROM submissions s
        WHERE s.user_id IN (?)
          AND s.status IN ('pending_review', 'changes_requested')
          AND s.deleted_at IS NULL`,
      [userIds],
    );
    const out = new Map<string, boolean>();
    for (const r of rows) out.set(r.user_id, true);
    return out;
  }
}

function applicantStatusFor(s: ApplicationStatus): ApplicantStatus {
  switch (s) {
    case 'submitted':
      return 'Under Review';
    case 'approved_invited':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'needs_info':
      return 'Revision Requested';
    case 'withdrawn':
      return 'Rejected';
  }
}

function platformStatusFor(s: string): PlatformUserStatus {
  switch (s) {
    case 'active':
      return 'Active';
    case 'invited':
      return 'Invited';
    case 'suspended':
      return 'Suspended';
    default:
      return 'Invited';
  }
}

function formatTaka(n: number): string {
  // Two decimals, no thousands separator — matches the live UI display.
  return `Tk ${n.toFixed(2)}`;
}

// Exported for unit tests (people.service.spec.ts).
export const __testing = { applicantStatusFor, platformStatusFor, formatTaka };
