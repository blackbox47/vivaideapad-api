import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import {
  LeaderboardPeriod,
  LeaderboardRecord,
} from './leaderboard-record.entity';

export interface LeaderboardRow {
  rank: number;
  user_id: string;
  email: string | null;
  display_name: string | null;
  score: string;
  approvals: number;
  submissions_count: number;
  streak: number;
  last_updated: Date | null;
}

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(LeaderboardRecord)
    private readonly repo: Repository<LeaderboardRecord>,
  ) {}

  /**
   * Increment score inside an existing transaction (called from
   * admin submission decide).
   */
  async incrementInTx(
    manager: EntityManager,
    input: {
      userId: string;
      period: LeaderboardPeriod;
      scoreDelta: string;
      approvalIncrement?: number;
    },
  ): Promise<LeaderboardRecord> {
    const repo = manager.getRepository(LeaderboardRecord);
    const existing = await repo.findOne({
      where: { userId: input.userId, period: input.period },
    });
    if (existing) {
      existing.score = (
        Number(existing.score) + Number(input.scoreDelta)
      ).toFixed(2);
      if (input.approvalIncrement) {
        existing.approvals += input.approvalIncrement;
      }
      existing.lastUpdated = new Date();
      return repo.save(existing);
    }
    const row = repo.create({
      userId: input.userId,
      period: input.period,
      score: Number(input.scoreDelta).toFixed(2),
      approvals: input.approvalIncrement ?? 0,
      submissionsCount: 0,
      streak: 0,
      lastUpdated: new Date(),
    });
    return repo.save(row);
  }

  async list(input: {
    period: LeaderboardPeriod;
    limit: number;
  }): Promise<LeaderboardRow[]> {
    const limit = Math.max(1, Math.min(200, input.limit));
    const rows = await this.repo
      .createQueryBuilder('lr')
      .leftJoin('users', 'u', 'u.id = lr.user_id')
      .where('lr.period = :p', { p: input.period })
      .andWhere('u.deleted_at IS NULL')
      .select([
        'lr.user_id AS user_id',
        'u.email AS email',
        'u.display_name AS display_name',
        'lr.score AS score',
        'lr.approvals AS approvals',
        'lr.submissions_count AS submissions_count',
        'lr.streak AS streak',
        'lr.last_updated AS last_updated',
      ])
      .orderBy('lr.score', 'DESC')
      .addOrderBy('lr.approvals', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((r: Record<string, unknown>, idx: number) => {
      const safeString = (v: unknown): string | null =>
        typeof v === 'string'
          ? v
          : v == null
            ? null
            : (v as { toString(): string }).toString();
      const safeDate = (v: unknown): Date | null =>
        v instanceof Date
          ? v
          : v == null
            ? null
            : new Date((v as { toString(): string }).toString());
      return {
        rank: idx + 1,
        user_id: safeString(r.user_id) ?? '',
        email: safeString(r.email),
        display_name: safeString(r.display_name),
        score: safeString(r.score) ?? '0',
        approvals: Number(r.approvals ?? 0),
        submissions_count: Number(r.submissions_count ?? 0),
        streak: Number(r.streak ?? 0),
        last_updated: safeDate(r.last_updated),
      };
    });
  }

  /**
   * Recompute the all_time leaderboard from posted ledger entries and
   * approved submission counts. Used by `POST /admin/leaderboard/recalculate`.
   */
  async recalculateAllTime(): Promise<{ updated: number }> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(LeaderboardRecord);

      // Aggregate signed score per user from posted ledger entries that
      // contribute to the contributor ranking.
      const scoreSql = `
        SELECT user_id, COALESCE(SUM(amount), 0) AS score
        FROM wallet_ledger_entries
        WHERE status = 'posted'
          AND type IN ('reward_credit','manual_adjustment','payout_reversal')
        GROUP BY user_id
      `;
      const scoreRows: Array<{ user_id: string; score: string }> =
        await manager.query(scoreSql);

      // Aggregate approved-submission counts per user.
      const approvalsSql = `
        SELECT user_id,
          COUNT(*) AS approvals,
          COALESCE(SUM(reward_amount), 0) AS rewards
        FROM submissions
        WHERE status = 'approved'
          AND deleted_at IS NULL
        GROUP BY user_id
      `;
      const approvalRows: Array<{
        user_id: string;
        approvals: string;
        rewards: string;
      }> = await manager.query(approvalsSql);

      const byUser = new Map<string, { score: number; approvals: number }>();
      for (const r of scoreRows) {
        byUser.set(String(r.user_id), {
          score: Number(r.score ?? 0),
          approvals: 0,
        });
      }
      for (const r of approvalRows) {
        const cur = byUser.get(String(r.user_id)) ?? {
          score: 0,
          approvals: 0,
        };
        cur.approvals = Number(r.approvals ?? 0);
        byUser.set(String(r.user_id), cur);
      }

      // Wipe + rebuild the all_time slice. Cheap because the table only
      // holds aggregated counters.
      await repo.delete({ period: 'all_time' });

      const now = new Date();
      const newRows = Array.from(byUser.entries()).map(([userId, agg]) =>
        repo.create({
          userId,
          period: 'all_time',
          score: agg.score.toFixed(2),
          approvals: agg.approvals,
          submissionsCount: agg.approvals,
          streak: 0,
          lastUpdated: now,
        }),
      );

      if (newRows.length > 0) {
        await repo.save(newRows);
      }

      return { updated: newRows.length };
    });
  }

  async findPublicTop(limit: number): Promise<
    Array<{
      rank: number;
      initials: string;
      name: string;
      wins: number;
      ideas: number;
      amount: number;
    }>
  > {
    const clampedLimit = Math.max(1, Math.min(20, limit));
    const rows = await this.repo
      .createQueryBuilder('lr')
      .leftJoin('users', 'u', 'u.id = lr.user_id')
      .where('lr.period = :p', { p: 'all_time' })
      .andWhere('u.deleted_at IS NULL')
      .andWhere('u.access_status = :status', { status: 'active' })
      .select([
        'lr.user_id AS user_id',
        'u.email AS email',
        'u.display_name AS display_name',
        'u.display_prefs AS display_prefs',
        'lr.score AS score',
        'lr.approvals AS approvals',
        'lr.submissions_count AS submissions_count',
      ])
      .orderBy('lr.score', 'DESC')
      .addOrderBy('lr.approvals', 'DESC')
      .addOrderBy('u.display_name', 'ASC')
      .limit(clampedLimit * 2)
      .getRawMany();

    const result: Array<{
      rank: number;
      initials: string;
      name: string;
      wins: number;
      ideas: number;
      amount: number;
    }> = [];

    for (const r of rows) {
      if (result.length >= clampedLimit) break;

      let prefs: Record<string, unknown> | null = null;
      if (typeof r.display_prefs === 'string') {
        try {
          prefs = JSON.parse(r.display_prefs);
        } catch {
          prefs = null;
        }
      } else if (r.display_prefs && typeof r.display_prefs === 'object') {
        prefs = r.display_prefs as Record<string, unknown>;
      }

      if (
        prefs?.visibility === 'Hidden' ||
        prefs?.is_public_identity === false
      ) {
        continue;
      }

      const displayName =
        typeof r.display_name === 'string' ? r.display_name.trim() : '';
      const email = typeof r.email === 'string' ? r.email.trim() : '';
      const name = displayName || (email ? email.split('@')[0] : 'Anonymous');

      const parts = name.split(/\s+/).filter(Boolean);
      let initials = '';
      if (parts.length >= 2) {
        initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      } else if (parts.length === 1 && parts[0].length > 0) {
        initials = parts[0].slice(0, 2).toUpperCase();
      } else {
        initials = '?';
      }

      result.push({
        rank: result.length + 1,
        initials,
        name,
        wins: Number(r.approvals ?? 0),
        ideas: Number(r.submissions_count ?? 0),
        amount: Number(r.score ?? 0),
      });
    }

    return result;
  }
}
