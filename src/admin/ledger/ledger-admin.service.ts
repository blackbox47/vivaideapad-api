import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { ApiException } from '../../common/exceptions/api-exception';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { LedgerEntry } from '../../contributor/entities/ledger-entry.entity';
import { ManualAdjustmentDto } from './dto/ledger-admin.dto';

@Injectable()
export class LedgerAdminService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(LedgerEntry)
    private readonly repo: Repository<LedgerEntry>,
    private readonly audit: AuditEventsService,
  ) {}

  async list(input: {
    user_id?: string;
    type?: LedgerEntry['type'];
    status?: LedgerEntry['status'];
    date_from?: string;
    date_to?: string;
    page: number;
    limit: number;
  }): Promise<{ data: LedgerEntry[]; total: number }> {
    const qb = this.repo.createQueryBuilder('l');
    if (input.user_id) qb.andWhere('l.user_id = :uid', { uid: input.user_id });
    if (input.type) qb.andWhere('l.type = :t', { t: input.type });
    if (input.status) qb.andWhere('l.status = :s', { s: input.status });
    if (input.date_from)
      qb.andWhere('l.created_at >= :df', { df: new Date(input.date_from) });
    if (input.date_to)
      qb.andWhere('l.created_at <= :dt', { dt: new Date(input.date_to) });
    qb.orderBy('l.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findOne(id: string): Promise<LedgerEntry> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw ApiException.notFound('LedgerEntry');
    return found;
  }

  /**
   * Insert a manual adjustment row + audit event in a single transaction.
   */
  async manualAdjustment(input: {
    actorId: string;
    body: ManualAdjustmentDto;
  }): Promise<LedgerEntry> {
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

      return saved;
    });
  }
}
