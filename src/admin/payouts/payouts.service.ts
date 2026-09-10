import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';

import { ApiException } from '../../common/exceptions/api-exception';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Notification } from '../notifications/notification.entity';
import { WalletService } from '../../contributor/wallet.service';
import { PayoutRequest, PayoutStatus } from './payout.entity';
import { LedgerEntry } from '../../contributor/entities/ledger-entry.entity';
import { CreatePayoutDto, ProcessPayoutDto } from './dto/payouts.dto';
import { User } from '../../users/entities/user.entity';

export interface SerializedPayout {
  id: string;
  user_id: string;
  display_name: string | null;
  amount: string;
  status: PayoutStatus;
  method: string | null;
  details: Record<string, unknown> | null;
  decision_notes: string | null;
  processing_reference: string | null;
  processed_at: Date | null;
  processed_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const toSerialized = (
  p: PayoutRequest,
  displayName: string | null = null,
): SerializedPayout => ({
  id: p.id,
  user_id: p.userId,
  display_name: displayName,
  amount: p.amount,
  status: p.status,
  method: p.method,
  details: p.details,
  decision_notes: p.decisionNotes,
  processing_reference: p.processingReference,
  processed_at: p.processedAt,
  processed_by: p.processedBy,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

@Injectable()
export class PayoutsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(PayoutRequest)
    private readonly repo: Repository<PayoutRequest>,
    private readonly audit: AuditEventsService,
    private readonly notify: NotificationsService,
    private readonly wallet: WalletService,
  ) {}

  private async serializeWithNames(
    rows: PayoutRequest[],
  ): Promise<SerializedPayout[]> {
    const ids = [...new Set(rows.map((row) => row.userId))];
    const users = ids.length
      ? await this.dataSource.getRepository(User).find({
          where: { id: In(ids) },
          select: ['id', 'displayName', 'email'],
        })
      : [];
    const nameById = new Map(
      users.map((user) => {
        const name = user.displayName?.trim() || user.email.trim();
        return [user.id, name || null] as const;
      }),
    );
    return rows.map((row) =>
      toSerialized(row, nameById.get(row.userId) ?? null),
    );
  }

  async list(input: {
    status?: PayoutStatus;
    user_id?: string;
    date_from?: string;
    date_to?: string;
    page: number;
    limit: number;
  }): Promise<{ data: SerializedPayout[]; total: number }> {
    const qb = this.repo.createQueryBuilder('p').where('p.deleted_at IS NULL');
    if (input.status) qb.andWhere('p.status = :s', { s: input.status });
    if (input.user_id) qb.andWhere('p.user_id = :uid', { uid: input.user_id });
    if (input.date_from)
      qb.andWhere('p.created_at >= :df', { df: new Date(input.date_from) });
    if (input.date_to)
      qb.andWhere('p.created_at <= :dt', { dt: new Date(input.date_to) });
    qb.orderBy('p.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [rows, total] = await qb.getManyAndCount();
    return { data: await this.serializeWithNames(rows), total };
  }

  async findOne(id: string): Promise<SerializedPayout> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Payout');
    const [serialized] = await this.serializeWithNames([found]);
    return serialized;
  }

  async listMine(input: {
    userId: string;
    page: number;
    limit: number;
  }): Promise<{ data: SerializedPayout[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.user_id = :uid', { uid: input.userId })
      .andWhere('p.deleted_at IS NULL')
      .orderBy('p.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [rows, total] = await qb.getManyAndCount();
    return { data: await this.serializeWithNames(rows), total };
  }

  /**
   * Contributor: request a payout. Atomic — balance check + payout row +
   * pending payout_hold ledger entry.
   */
  async request(input: {
    userId: string;
    body: CreatePayoutDto;
  }): Promise<SerializedPayout> {
    const amount = Number(input.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw ApiException.validation('Amount must be a positive number');
    }
    return this.dataSource.transaction(async (manager) => {
      // Balance check — sum of posted entries.
      const summary = await this.wallet.summary(input.userId);
      const balance = Number(summary.balance);
      if (balance < amount) {
        throw ApiException.insufficientBalance();
      }

      const rawDetails = input.body.details ?? {};
      const mobileNum = input.body.mobile ?? input.body.phone;
      const details: Record<string, unknown> = {
        ...rawDetails,
        ...(mobileNum
          ? {
              mobile: mobileNum,
              phone: mobileNum,
              account_number: rawDetails.account_number ?? mobileNum,
            }
          : {}),
      };
      const detailsToSave = Object.keys(details).length > 0 ? details : null;

      const repo = manager.getRepository(PayoutRequest);
      const row = repo.create({
        userId: input.userId,
        amount: amount.toFixed(2),
        status: 'pending',
        method: input.body.method ?? null,
        details: detailsToSave,
        decisionNotes: null,
        processingReference: null,
        processedAt: null,
        processedBy: null,
      });
      const saved = await repo.save(row);

      await this.wallet.recordInTx(manager, {
        userId: input.userId,
        type: 'payout_hold',
        amount: (-amount).toFixed(2),
        status: 'pending',
        reference: `payout:${saved.id}`,
        metadata: {
          payout_id: saved.id,
          description: input.body.method
            ? mobileNum
              ? `${input.body.method} · ${mobileNum}`
              : `${input.body.method} payout`
            : 'Withdrawal request',
        },
      });

      return toSerialized(saved);
    });
  }

  async adminCreate(input: {
    actorId: string;
    userId: string;
    body: CreatePayoutDto;
  }): Promise<SerializedPayout> {
    const amount = Number(input.body.amount);
    const rawDetails = input.body.details ?? {};
    const mobileNum = input.body.mobile ?? input.body.phone;
    const details: Record<string, unknown> = {
      ...rawDetails,
      ...(mobileNum
        ? {
            mobile: mobileNum,
            phone: mobileNum,
            account_number: rawDetails.account_number ?? mobileNum,
          }
        : {}),
    };
    const detailsToSave = Object.keys(details).length > 0 ? details : null;

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PayoutRequest);
      const row = repo.create({
        userId: input.userId,
        amount: amount.toFixed(2),
        status: 'pending',
        method: input.body.method ?? null,
        details: detailsToSave,
      });
      const saved = await repo.save(row);

      await this.wallet.recordInTx(manager, {
        userId: input.userId,
        type: 'payout_hold',
        amount: (-amount).toFixed(2),
        status: 'pending',
        reference: `payout:${saved.id}`,
        metadata: {
          payout_id: saved.id,
          description: input.body.method
            ? mobileNum
              ? `${input.body.method} · ${mobileNum}`
              : `${input.body.method} payout`
            : 'Withdrawal request',
        },
      });

      await this.audit.record(manager, {
        actorId: input.actorId,
        action: 'payout.created',
        targetType: 'payout',
        targetId: saved.id,
        context: { user_id: input.userId, amount: amount.toFixed(2) },
      });

      const users = await manager.getRepository(User).find({
        where: { id: input.userId },
        select: ['id', 'displayName', 'email'],
      });
      const name =
        users[0]?.displayName?.trim() || users[0]?.email?.trim() || null;
      return toSerialized(saved, name);
    });
  }

  /**
   * Admin: mark_paid or reject a payout. Transactional — flip status, flip
   * pending ledger status (mark_paid → posted, reject → reversed), insert
   * reversal ledger row on reject, audit + notification.
   */
  async process(input: {
    id: string;
    actorId: string;
    body: ProcessPayoutDto;
  }): Promise<SerializedPayout> {
    const { id, actorId, body } = input;

    const rawAction = (body.action || body.status || '').toLowerCase();
    let nextStatus: PayoutStatus;
    let actionName: 'mark_paid' | 'reject';

    if (rawAction === 'mark_paid' || rawAction === 'paid') {
      nextStatus = 'paid';
      actionName = 'mark_paid';
    } else if (rawAction === 'reject' || rawAction === 'rejected') {
      nextStatus = 'rejected';
      actionName = 'reject';
    } else {
      throw ApiException.validation('Unknown action or status');
    }

    const reference =
      (
        body.reference ??
        body.processing_reference ??
        body.transaction_reference ??
        ''
      ).trim() || null;

    const note =
      (
        body.note ??
        body.notes ??
        body.admin_notes ??
        body.decision_notes ??
        body.rejection_reason ??
        ''
      ).trim() || null;

    let savedNotification: Notification | null = null;

    const result = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PayoutRequest);
      const found = await repo
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id })
        .andWhere('p.deleted_at IS NULL')
        .getOne();

      if (!found) throw ApiException.notFound('Payout');
      if (found.status !== 'pending') {
        throw ApiException.businessRule(
          'invalid_state',
          `Cannot process payout in status ${found.status}`,
        );
      }

      const ledgerRepo = manager.getRepository(LedgerEntry);
      const pendingLedger = await ledgerRepo.findOne({
        where: { reference: `payout:${id}`, status: 'pending' },
      });

      if (pendingLedger) {
        if (actionName === 'mark_paid') {
          pendingLedger.status = 'posted';
          pendingLedger.postedAt = new Date();
          await ledgerRepo.save(pendingLedger);
        } else {
          // reject — flip the pending hold to reversed so the hold is released
          // and the contributor's available balance is restored.
          pendingLedger.status = 'reversed';
          await ledgerRepo.save(pendingLedger);
        }
      } else if (actionName === 'mark_paid') {
        // Fallback for payouts seeded or created without a pending hold entry
        await this.wallet.recordInTx(manager, {
          userId: found.userId,
          type: 'payout_hold',
          amount: (-Number(found.amount)).toFixed(2),
          status: 'posted',
          reference: `payout:${id}`,
          metadata: {
            payout_id: id,
            description: found.method
              ? `${found.method} payout`
              : 'Withdrawal request',
            processing_reference: reference ?? undefined,
          },
        });
      }

      found.status = nextStatus;
      found.processedAt = new Date();
      found.processedBy = actorId;
      found.processingReference = reference;
      found.decisionNotes = note;
      const saved = await repo.save(found);

      await this.audit.record(manager, {
        actorId,
        action: `payout.${actionName}`,
        targetType: 'payout',
        targetId: found.id,
        category: 'payouts',
        context: {
          previous_status: 'pending',
          new_status: nextStatus,
          reference,
          note,
        },
      });

      savedNotification = await this.notify.emit(manager, {
        recipientId: found.userId,
        type: 'payout_status_changed',
        title:
          actionName === 'mark_paid'
            ? `Your payout of ৳${found.amount} has been paid`
            : `Your payout request was rejected`,
        body: note ?? undefined,
        linkedRecordType: 'payout',
        linkedRecordId: found.id,
        payload: { action: actionName, status: nextStatus, reference },
      });

      const users = await manager.getRepository(User).find({
        where: { id: found.userId },
        select: ['id', 'displayName', 'email'],
      });
      const name =
        users[0]?.displayName?.trim() || users[0]?.email?.trim() || null;
      return toSerialized(saved, name);
    });

    if (savedNotification) {
      this.notify.publishCreated(savedNotification);
    }
    return result;
  }
}
