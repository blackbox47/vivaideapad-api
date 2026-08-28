import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';

import { ApiException } from '../../common/exceptions/api-exception';
import { User } from '../../users/entities/user.entity';
import { AuditEvent } from './audit-event.entity';

export interface RecordAuditInput {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  category?: string;
  context?: Record<string, unknown>;
}

export interface SerializedAuditEvent {
  id: string;
  actor: { id: string; name: string };
  action: string;
  target_id: string;
  target_type: string;
  category: string;
  context: Record<string, unknown> | null;
  occurred_at: string;
}

const SPEC_CATEGORY_STORE: Record<string, string[]> = {
  content: ['content', 'submissions', 'concepts'],
  applicant: ['applicant', 'applicants', 'applications'],
  applicants: ['applicant', 'applicants', 'applications'],
  payout: ['payout', 'payouts', 'ledger'],
  payouts: ['payout', 'payouts', 'ledger'],
  system: ['system', 'admins', 'users', 'profile', 'notifications'],
};

function storedCategoriesFor(category?: string): string[] | undefined {
  const trimmed = category?.trim();
  if (!trimmed) {
    return undefined;
  }
  const key = trimmed.toLowerCase();
  if (key === 'all') {
    return undefined;
  }
  return SPEC_CATEGORY_STORE[key] ?? [trimmed];
}

function specCategory(raw: string | null): string {
  const value = (raw ?? '').toLowerCase();
  if (SPEC_CATEGORY_STORE.content.includes(value)) {
    return 'content';
  }
  if (SPEC_CATEGORY_STORE.applicant.includes(value)) {
    return 'applicant';
  }
  if (SPEC_CATEGORY_STORE.payout.includes(value)) {
    return 'payout';
  }
  return 'system';
}

function actorName(user: User | undefined, actorId: string): string {
  const name = user?.displayName?.trim();
  if (name) {
    return name;
  }
  if (user?.email) {
    return user.email;
  }
  return actorId;
}

function toIso(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

@Injectable()
export class AuditEventsService {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly repo: Repository<AuditEvent>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /**
   * Insert an audit event inside an existing transaction. The caller MUST
   * pass the EntityManager from `DataSource.transaction(...)` so the write
   * is part of the same atomic batch.
   */
  async record(
    manager: EntityManager,
    input: RecordAuditInput,
  ): Promise<AuditEvent> {
    const repo = manager.getRepository(AuditEvent);
    const row = repo.create({
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      category: input.category ?? null,
      context: input.context ?? null,
    });
    return repo.save(row);
  }

  /**
   * Convenience: insert audit event outside a transaction (rare — prefer
   * the `manager`-flavoured overload for any decision flow).
   */
  async recordStandalone(input: RecordAuditInput): Promise<AuditEvent> {
    const row = this.repo.create({
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      category: input.category ?? null,
      context: input.context ?? null,
    });
    return this.repo.save(row);
  }

  async list(input: {
    actor_id?: string;
    target_type?: string;
    target_id?: string;
    action?: string;
    category?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    page: number;
    limit: number;
  }): Promise<{ data: SerializedAuditEvent[]; total: number }> {
    const qb = this.repo.createQueryBuilder('a');
    if (input.actor_id) {
      qb.andWhere('a.actor_id = :aid', { aid: input.actor_id });
    }
    if (input.target_type) {
      qb.andWhere('a.target_type = :tt', { tt: input.target_type });
    }
    if (input.target_id) {
      qb.andWhere('a.target_id = :tid', { tid: input.target_id });
    }
    if (input.action) {
      qb.andWhere('a.action = :act', { act: input.action });
    }
    const categories = storedCategoriesFor(input.category);
    if (categories) {
      qb.andWhere('a.category IN (:...cats)', { cats: categories });
    }
    const search = input.search?.trim();
    if (search) {
      qb.leftJoin(User, 'actor', 'actor.id = a.actor_id');
      qb.andWhere(
        '(a.action LIKE :s OR a.target_type LIKE :s OR a.target_id LIKE :s OR a.category LIKE :s OR actor.display_name LIKE :s OR actor.email LIKE :s)',
        { s: `%${search}%` },
      );
    }
    if (input.date_from) {
      qb.andWhere('a.occurred_at >= :df', {
        df: new Date(input.date_from),
      });
    }
    if (input.date_to) {
      qb.andWhere('a.occurred_at <= :dt', {
        dt: new Date(input.date_to),
      });
    }
    qb.orderBy('a.occurred_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [rows, total] = await qb.getManyAndCount();
    return {
      data: await this.serializeMany(rows),
      total,
    };
  }

  async findOne(id: string): Promise<SerializedAuditEvent> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) {
      throw ApiException.notFound('AuditEvent');
    }
    const [serialized] = await this.serializeMany([found]);
    return serialized;
  }

  private async serializeMany(
    rows: AuditEvent[],
  ): Promise<SerializedAuditEvent[]> {
    const actorIds = [...new Set(rows.map((row) => row.actorId))];
    const actors =
      actorIds.length === 0
        ? []
        : await this.users.find({ where: { id: In(actorIds) } });
    const actorById = new Map(actors.map((user) => [user.id, user]));

    return rows.map((row) => {
      const actor = actorById.get(row.actorId);
      return {
        id: row.id,
        actor: {
          id: row.actorId,
          name: actorName(actor, row.actorId),
        },
        action: row.action,
        target_id: row.targetId,
        target_type: row.targetType,
        category: specCategory(row.category),
        context: row.context,
        occurred_at: toIso(row.occurredAt),
      };
    });
  }
}
