import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, ObjectLiteral, Repository } from 'typeorm';

import { User, USER_ROLES } from '../../users/entities/user.entity';
import { Category } from '../categories/category.entity';
import { Concept } from '../concepts/concept.entity';
import { Application } from '../applications/application.entity';
import { Submission } from '../../contributor/entities/submission.entity';
import { LedgerEntry } from '../../contributor/entities/ledger-entry.entity';
import { PayoutRequest } from '../payouts/payout.entity';
import { Notification } from '../notifications/notification.entity';

export interface DashboardOverview {
  users: {
    total: number;
    by_role: Record<string, number>;
    by_access_status: Record<string, number>;
    new_last_30d: number;
  };
  categories: { total: number; active: number };
  concepts: {
    total: number;
    by_status: Record<string, number>;
  };
  applications: {
    total: number;
    by_status: Record<string, number>;
    pending_review: number;
  };
  submissions: {
    total: number;
    by_status: Record<string, number>;
    pending_review: number;
  };
  payouts: {
    total: number;
    by_status: Record<string, number>;
    pending_count: number;
  };
  wallet: {
    posted_balance_total: string;
    pending_balance_total: string;
  };
  generated_at: string;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Concept)
    private readonly concepts: Repository<Concept>,
    @InjectRepository(Application)
    private readonly applications: Repository<Application>,
    @InjectRepository(Submission)
    private readonly submissions: Repository<Submission>,
    @InjectRepository(LedgerEntry)
    private readonly ledger: Repository<LedgerEntry>,
    @InjectRepository(PayoutRequest)
    private readonly payouts: Repository<PayoutRequest>,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
  ) {}

  async overview(): Promise<DashboardOverview> {
    const [
      usersTotal,
      usersByRole,
      usersByAccess,
      newLast30,
      categoriesTotal,
      categoriesActive,
      conceptsTotal,
      conceptsByStatus,
      appsTotal,
      appsByStatus,
      appsPending,
      subsTotal,
      subsByStatus,
      subsPending,
      payoutsTotal,
      payoutsByStatus,
      payoutsPending,
      postedBalanceRaw,
      pendingBalanceRaw,
    ] = await Promise.all([
      this.users.count({ where: { deletedAt: IsNull() } }),
      this.countByEnum(this.users, 'role', [
        USER_ROLES.ADMINISTRATOR,
        USER_ROLES.CONTRIBUTOR,
        USER_ROLES.SUPERADMIN,
      ]),
      this.countByEnum(this.users, 'access_status', [
        'active',
        'invited',
        'suspended',
        'pending_review',
      ]),
      this.users
        .createQueryBuilder('u')
        .where('u.deleted_at IS NULL')
        .andWhere('u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)')
        .getCount(),
      this.categories.count({ where: { deletedAt: IsNull() } }),
      this.categories.count({
        where: { isActive: 'active' as never, deletedAt: IsNull() },
      }),
      this.concepts.count({ where: { deletedAt: IsNull() } }),
      this.countByEnum(this.concepts, 'status', [
        'draft',
        'scheduled',
        'active',
        'archived',
      ]),
      this.applications.count({ where: { deletedAt: IsNull() } }),
      this.countByEnum(this.applications, 'status', [
        'submitted',
        'approved_invited',
        'rejected',
        'needs_info',
        'withdrawn',
      ]),
      this.applications.count({
        where: { status: 'submitted' as never, deletedAt: IsNull() },
      }),
      this.submissions.count({ where: { deletedAt: IsNull() } }),
      this.countByEnum(this.submissions, 'status', [
        'draft',
        'pending_review',
        'changes_requested',
        'approved',
        'rejected',
      ]),
      this.submissions.count({
        where: { status: 'pending_review' as never, deletedAt: IsNull() },
      }),
      this.payouts.count({ where: { deletedAt: IsNull() } }),
      this.countByEnum(this.payouts, 'status', ['pending', 'paid', 'rejected']),
      this.payouts.count({
        where: { status: 'pending' as never, deletedAt: IsNull() },
      }),
      this.sumLedger('posted'),
      this.sumLedger('pending'),
    ]);

    return {
      users: {
        total: usersTotal,
        by_role: usersByRole,
        by_access_status: usersByAccess,
        new_last_30d: newLast30,
      },
      categories: {
        total: categoriesTotal,
        active: categoriesActive,
      },
      concepts: {
        total: conceptsTotal,
        by_status: conceptsByStatus,
      },
      applications: {
        total: appsTotal,
        by_status: appsByStatus,
        pending_review: appsPending,
      },
      submissions: {
        total: subsTotal,
        by_status: subsByStatus,
        pending_review: subsPending,
      },
      payouts: {
        total: payoutsTotal,
        by_status: payoutsByStatus,
        pending_count: payoutsPending,
      },
      wallet: {
        posted_balance_total: postedBalanceRaw,
        pending_balance_total: pendingBalanceRaw,
      },
      generated_at: new Date().toISOString(),
    };
  }

  async stats(input: { days?: number }): Promise<{
    days: number;
    applications_per_day: Array<{ date: string; count: number }>;
    submissions_per_day: Array<{ date: string; count: number }>;
    approvals_per_day: Array<{
      date: string;
      count: number;
      total_reward: string;
    }>;
  }> {
    const days = Math.max(1, Math.min(180, input.days ?? 30));
    const since = new Date();
    since.setDate(since.getDate() - days);

    const apps = await this.applications
      .createQueryBuilder('a')
      .select('DATE(a.created_at)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('a.created_at >= :since', { since })
      .andWhere('a.deleted_at IS NULL')
      .groupBy('DATE(a.created_at)')
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; count: string }>();

    const subs = await this.submissions
      .createQueryBuilder('s')
      .select('DATE(s.created_at)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('s.created_at >= :since', { since })
      .andWhere('s.deleted_at IS NULL')
      .groupBy('DATE(s.created_at)')
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; count: string }>();

    const approvals = await this.submissions
      .createQueryBuilder('s')
      .select('DATE(s.decided_at)', 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(s.reward_amount), 0)', 'total_reward')
      .where('s.decided_at IS NOT NULL')
      .andWhere('s.status = :st', { st: 'approved' })
      .andWhere('s.decided_at >= :since', { since })
      .groupBy('DATE(s.decided_at)')
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; count: string; total_reward: string }>();

    return {
      days,
      applications_per_day: apps.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      submissions_per_day: subs.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      approvals_per_day: approvals.map((r) => ({
        date: r.date,
        count: Number(r.count),
        total_reward: r.total_reward,
      })),
    };
  }

  private async countByEnum<T extends ObjectLiteral>(
    repo: Repository<T>,
    column: string,
    values: ReadonlyArray<string | number>,
  ): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const v of values) result[String(v)] = 0;
    const rows = await repo
      .createQueryBuilder('t')
      .select(`t.${column}`, 'k')
      .addSelect('COUNT(*)', 'c')
      .where('t.deleted_at IS NULL')
      .groupBy(`t.${column}`)
      .getRawMany<{ k: string; c: string }>();
    for (const row of rows) {
      if (row.k) {
        result[row.k] = Number(row.c);
      }
    }
    return result;
  }

  private async sumLedger(status: 'posted' | 'pending'): Promise<string> {
    const row = await this.ledger
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.amount), 0)', 'sum')
      .where('l.status = :st', { st: status })
      .getRawOne<{ sum: string }>();
    return row?.sum ?? '0';
  }
}
