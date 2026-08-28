import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository, In } from 'typeorm';

import { ApiException } from '../../common/exceptions/api-exception';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { User, UserRole } from '../../users/entities/user.entity';
import {
  Notification,
  NotificationReadState,
  NotificationType,
} from './notification.entity';
import {
  buildPaginationMeta,
  PaginatedResult,
} from '../../common/utils/pagination';

export interface SerializedAdminNotification {
  id: string;
  recipient_id: string;
  recipient_email: string | null;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  linked_record_type: string | null;
  linked_record_id: string | null;
  read_state: NotificationReadState;
  read_at: Date | null;
  created_at: Date;
}

@Injectable()
export class AdminNotificationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly audit: AuditEventsService,
  ) {}

  async listForRecipient(input: {
    recipientId: string;
    read_state?: NotificationReadState;
    page: number;
    limit: number;
  }): Promise<{
    data: SerializedAdminNotification[];
    meta: PaginatedResult<unknown>['meta'];
  }> {
    const qb = this.repo
      .createQueryBuilder('n')
      .leftJoin(User, 'u', 'u.id = n.recipient_id')
      .where('n.recipient_id = :rid', { rid: input.recipientId })
      .andWhere('n.deleted_at IS NULL')
      .select([
        'n.id AS id',
        'n.recipient_id AS recipient_id',
        'u.email AS recipient_email',
        'n.type AS type',
        'n.title AS title',
        'n.body AS body',
        'n.payload AS payload',
        'n.linked_record_type AS linked_record_type',
        'n.linked_record_id AS linked_record_id',
        'n.read_state AS read_state',
        'n.read_at AS read_at',
        'n.created_at AS created_at',
      ]);
    if (input.read_state) {
      qb.andWhere('n.read_state = :rs', { rs: input.read_state });
    }
    qb.orderBy('n.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [rows, total] = await Promise.all([qb.getRawMany(), qb.getCount()]);
    return {
      data: rows.map((r: Record<string, unknown>) => {
        const get = (k: string): string | null => {
          const v = r[k];
          if (typeof v === 'string') return v;
          if (v == null) return null;
          return (v as { toString(): string }).toString();
        };
        return {
          id: String(r.id),
          recipient_id: String(r.recipient_id),
          recipient_email: get('recipient_email'),
          type: String(r.type),
          title: String(r.title),
          body: get('body'),
          payload: (r.payload as Record<string, unknown> | null) ?? null,
          linked_record_type: get('linked_record_type'),
          linked_record_id: get('linked_record_id'),
          read_state: String(r.read_state) as NotificationReadState,
          read_at:
            r.read_at instanceof Date
              ? r.read_at
              : r.read_at
                ? new Date((r.read_at as { toString(): string }).toString())
                : null,
          created_at:
            r.created_at instanceof Date
              ? r.created_at
              : new Date((r.created_at as { toString(): string }).toString()),
        };
      }),
      meta: buildPaginationMeta(input.page, input.limit, total),
    };
  }

  async broadcast(input: {
    actorId: string;
    body: {
      recipient_ids?: string[];
      role_target?: UserRole;
      type: NotificationType;
      title: string;
      body?: string;
      payload?: Record<string, unknown>;
      linked_record_type?: string;
      linked_record_id?: string;
    };
  }): Promise<{ sent: number }> {
    let targetIds: string[];
    if (input.body.recipient_ids && input.body.recipient_ids.length > 0) {
      const found = await this.users.find({
        where: { id: In(input.body.recipient_ids), deletedAt: IsNull() },
        select: ['id'],
      });
      targetIds = found.map((u) => u.id);
    } else if (input.body.role_target) {
      const found = await this.users.find({
        where: { role: input.body.role_target, deletedAt: IsNull() },
        select: ['id'],
      });
      targetIds = found.map((u) => u.id);
    } else {
      throw ApiException.validation(
        'Provide either recipient_ids or role_target',
      );
    }

    if (targetIds.length === 0) {
      return { sent: 0 };
    }

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Notification);
      const rows = targetIds.map((rid) =>
        repo.create({
          recipientId: rid,
          type: input.body.type,
          title: input.body.title,
          body: input.body.body ?? null,
          payload: input.body.payload ?? null,
          linkedRecordType: input.body.linked_record_type ?? null,
          linkedRecordId: input.body.linked_record_id ?? null,
          readState: 'unread',
          readAt: null,
        }),
      );
      await repo.save(rows);
      await this.audit.record(manager, {
        actorId: input.actorId,
        action: 'notifications.broadcast',
        targetType: 'notification',
        targetId: 'batch',
        category: 'notifications',
        context: {
          type: input.body.type,
          recipient_count: targetIds.length,
        },
      });
    });

    return { sent: targetIds.length };
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Notification');
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Notification).softRemove(found);
      await this.audit.record(manager, {
        actorId,
        action: 'notification.deleted',
        targetType: 'notification',
        targetId: id,
        category: 'notifications',
        context: { recipient_id: found.recipientId },
      });
    });
  }
}
