import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import { ApiException } from '../../common/exceptions/api-exception';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Notification } from '../notifications/notification.entity';
import { WalletService } from '../../contributor/wallet.service';
import { PayoutRequest, PayoutStatus } from './payout.entity';
import { LedgerEntry } from '../../contributor/entities/ledger-entry.entity';
import { CreatePayoutDto, ProcessPayoutDto } from './dto/payouts.dto';

export interface SerializedPayout {
  id: string;
  user_id: string;
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

const toSerialized = (p: PayoutRequest): SerializedPayout => ({
  id: p.id,
  user_id: p.userId,
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
    return { data: rows.map(toSerialized), total };
  }

  async findOne(id: string): Promise<SerializedPayout> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Payout');
    return toSerialized(found);
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
    return { data: rows.map(toSerialized), total };
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

    const row = this.repo.create({
      userId: input.userId,
      amount: amount.toFixed(2),
      status: 'pending',
      method: input.body.method ?? null,
      details: detailsToSave,
    });
    const saved = await this.repo.save(row);
    await this.audit.recordStandalone({
      actorId: input.actorId,
      action: 'payout.created',
      targetType: 'payout',
      targetId: saved.id,
      context: { user_id: input.userId, amount: amount.toFixed(2) },
    });
    return toSerialized(saved);
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
      if (!pendingLedger) {
        throw ApiException.businessRule(
          'ledger_missing',
          'Pending hold entry not found',
        );
      }

      let nextStatus: PayoutStatus;
      switch (body.action) {
        case 'mark_paid':
          nextStatus = 'paid';
          break;
        case 'reject':
          nextStatus = 'rejected';
          break;
        default:
          throw ApiException.validation('Unknown action');
      }

      found.status = nextStatus;
      found.processedAt = new Date();
      found.processedBy = actorId;
      found.processingReference = body.reference ?? null;
      found.decisionNotes = body.note ?? null;
      const saved = await repo.save(found);

      if (body.action === 'mark_paid') {
        pendingLedger.status = 'posted';
        pendingLedger.postedAt = new Date();
        await ledgerRepo.save(pendingLedger);
      } else {
        // reject — flip the pending hold to reversed + insert a fresh
        // posted reversal ledger so the contributor's balance is restored.
        pendingLedger.status = 'reversed';
        await ledgerRepo.save(pendingLedger);

        await this.wallet.recordInTx(manager, {
          userId: found.userId,
          type: 'payout_reversal',
          amount: Math.abs(Number(pendingLedger.amount)).toFixed(2),
          status: 'posted',
          reference: `payout:${id}`,
          metadata: { payout_id: id, reversal_of: pendingLedger.id },
        });
      }

      await this.audit.record(manager, {
        actorId,
        action: `payout.${body.action}`,
        targetType: 'payout',
        targetId: found.id,
        category: 'payouts',
        context: {
          previous_status: 'pending',
          new_status: nextStatus,
          reference: body.reference ?? null,
          note: body.note ?? null,
        },
      });

      savedNotification = await this.notify.emit(manager, {
        recipientId: found.userId,
        type: 'payout_status_changed',
        title:
          body.action === 'mark_paid'
            ? `Your payout of ৳${found.amount} has been paid`
            : `Your payout request was rejected`,
        body: body.note ?? undefined,
        linkedRecordType: 'payout',
        linkedRecordId: found.id,
        payload: { action: body.action, status: nextStatus },
      });

      return toSerialized(saved);
    });

    if (savedNotification) {
      this.notify.publishCreated(savedNotification);
    }
    return result;
  }
}
