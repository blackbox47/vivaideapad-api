import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import {
  LedgerEntry,
  LedgerEntryStatus,
  LedgerEntryType,
} from './entities/ledger-entry.entity';
import { LedgerListQueryDto } from './dto/ledger.dto';

export interface WalletSummary {
  balance: string;
  pending: string;
  lifetime_credits: string;
  lifetime_debits: string;
}

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(LedgerEntry)
    private readonly repo: Repository<LedgerEntry>,
  ) {}

  /**
   * Balance = SUM of posted entries (signed) + pending payout holds.
   * Pending  = -SUM of pending payout_hold entries (so the contributor
   *            can see how much is reserved for an in-flight payout).
   * Lifetime_credits = +SUM of posted credits (reward_credit, manual_adjustment > 0)
   * Lifetime_debits  = -SUM of posted debits (payout_hold, payout_reversal, manual_adjustment < 0)
   */
  async summary(userId: string): Promise<WalletSummary> {
    const row = await this.repo
      .createQueryBuilder('l')
      .select(
        'COALESCE(SUM(CASE WHEN l.status = :posted OR (l.status = :pending AND l.type = :hold) THEN l.amount ELSE 0 END), 0)',
        'balance',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN l.status = :pending AND l.type = :hold THEN -l.amount ELSE 0 END), 0)',
        'pending',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN l.status = :posted AND l.amount > 0 THEN l.amount ELSE 0 END), 0)',
        'lifetime_credits',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN l.status = :posted AND l.amount < 0 THEN -l.amount ELSE 0 END), 0)',
        'lifetime_debits',
      )
      .where('l.user_id = :uid', { uid: userId })
      .setParameters({
        posted: 'posted' as LedgerEntryStatus,
        pending: 'pending' as LedgerEntryStatus,
        hold: 'payout_hold' as LedgerEntryType,
      })
      .getRawOne<{
        balance: string;
        pending: string;
        lifetime_credits: string;
        lifetime_debits: string;
      }>();

    return {
      balance: row?.balance ?? '0',
      pending: row?.pending ?? '0',
      lifetime_credits: row?.lifetime_credits ?? '0',
      lifetime_debits: row?.lifetime_debits ?? '0',
    };
  }

  async listForUser(input: {
    userId: string;
    query: LedgerListQueryDto;
  }): Promise<{ data: LedgerEntry[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('l')
      .where('l.user_id = :uid', { uid: input.userId });
    if (input.query.type) {
      qb.andWhere('l.type = :t', { t: input.query.type });
    }
    if (input.query.status) {
      qb.andWhere('l.status = :s', { s: input.query.status });
    }
    if (input.query.date_from) {
      qb.andWhere('l.created_at >= :df', {
        df: new Date(input.query.date_from),
      });
    }
    if (input.query.date_to) {
      qb.andWhere('l.created_at <= :dt', {
        dt: new Date(input.query.date_to),
      });
    }
    const page = input.query.page ?? 1;
    const limit = input.query.limit ?? 20;
    qb.orderBy('l.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  /**
   * Insert a ledger row inside an existing transaction.
   * Used by every decision flow that needs to mint a reward / reversal.
   */
  async recordInTx(
    manager: EntityManager,
    input: {
      userId: string;
      type: LedgerEntryType;
      amount: string;
      status: LedgerEntryStatus;
      reference: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<LedgerEntry> {
    const repo = manager.getRepository(LedgerEntry);
    const row = repo.create({
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      status: input.status,
      reference: input.reference,
      metadata: input.metadata ?? null,
      postedAt: input.status === 'posted' ? new Date() : null,
    });
    return repo.save(row);
  }
}
