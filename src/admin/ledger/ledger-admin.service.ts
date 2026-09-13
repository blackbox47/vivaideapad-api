import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Like, Repository } from 'typeorm';

import { ApiException } from '../../common/exceptions/api-exception';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { LedgerEntry } from '../../contributor/entities/ledger-entry.entity';
import { User } from '../../users/entities/user.entity';
import { ManualAdjustmentDto } from './dto/ledger-admin.dto';

export interface SerializedLedgerEntry {
  id: string;
  user_id: string;
  display_name: string | null;
  type: LedgerEntry['type'];
  amount: string;
  status: LedgerEntry['status'];
  reference: string;
  metadata: Record<string, unknown> | null;
  posted_at: Date | null;
  created_at: Date;
}

const toSerialized = (
  row: LedgerEntry,
  displayName: string | null = null,
): SerializedLedgerEntry => ({
  id: row.id,
  user_id: row.userId,
  display_name: displayName,
  type: row.type,
  amount: row.amount,
  status: row.status,
  reference: row.reference,
  metadata: row.metadata,
  posted_at: row.postedAt,
  created_at: row.createdAt,
});

@Injectable()
export class LedgerAdminService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(LedgerEntry)
    private readonly repo: Repository<LedgerEntry>,
    private readonly audit: AuditEventsService,
  ) {}

  private async serializeWithNames(
    rows: LedgerEntry[],
  ): Promise<SerializedLedgerEntry[]> {
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
    user_id?: string;
    type?: LedgerEntry['type'];
    status?: LedgerEntry['status'];
    date_from?: string;
    date_to?: string;
    search?: string;
    page: number;
    limit: number;
  }): Promise<{ data: SerializedLedgerEntry[]; total: number }> {
    const qb = this.repo.createQueryBuilder('l');
    if (input.user_id) qb.andWhere('l.user_id = :uid', { uid: input.user_id });
    if (input.type) qb.andWhere('l.type = :t', { t: input.type });
    if (input.status) qb.andWhere('l.status = :s', { s: input.status });
    if (input.date_from)
      qb.andWhere('l.created_at >= :df', { df: new Date(input.date_from) });
    if (input.date_to)
      qb.andWhere('l.created_at <= :dt', { dt: new Date(input.date_to) });

    if (input.search?.trim()) {
      const s = `%${input.search.trim()}%`;
      const matchingUsers = await this.dataSource.getRepository(User).find({
        where: [{ displayName: Like(s) }, { email: Like(s) }],
        select: ['id'],
      });
      const userIds = matchingUsers.map((u) => u.id);
      if (userIds.length > 0) {
        qb.andWhere('(l.user_id IN (:...userIds) OR l.reference LIKE :s)', {
          userIds,
          s,
        });
      } else {
        qb.andWhere('l.reference LIKE :s', { s });
      }
    }

    qb.orderBy('l.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [rows, total] = await qb.getManyAndCount();
    return { data: await this.serializeWithNames(rows), total };
  }

  async findOne(id: string): Promise<SerializedLedgerEntry> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw ApiException.notFound('LedgerEntry');
    const [serialized] = await this.serializeWithNames([found]);
    return serialized;
  }

  /**
   * Insert a manual adjustment row + audit event in a single transaction.
   */
  async manualAdjustment(input: {
    actorId: string;
    body: ManualAdjustmentDto;
  }): Promise<SerializedLedgerEntry> {
    const { actorId, body } = input;

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(LedgerEntry);
      const row = repo.create({
        userId: body.user_id,
        type: body.type,
        amount: body.amount.toFixed(2),
        status: 'posted',
        reference:
          body.reference ??
          `manual:${Date.now()}:${Math.random().toString(36).slice(-6)}`,
        metadata: { description: body.description ?? null, actor_id: actorId },
        postedAt: new Date(),
      });
      const saved = await repo.save(row);

      await this.audit.record(manager, {
        actorId,
        action: 'ledger.manual_adjustment',
        targetType: 'user',
        targetId: body.user_id,
        category: 'ledger',
        context: {
          type: body.type,
          amount: body.amount.toFixed(2),
          reference: saved.reference,
          description: body.description ?? null,
        },
      });

      const [serialized] = await this.serializeWithNames([saved]);
      return serialized;
    });
  }
}
