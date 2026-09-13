import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';

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
  read_at: string | null;
  created_at: string;
}

function toUtcIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
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
      .where('n.recipientId = :rid', { rid: input.recipientId })
      .andWhere('n.deletedAt IS NULL');
    if (input.read_state) {
      qb.andWhere('n.readState = :rs', { rs: input.read_state });
    }
    qb.orderBy('n.createdAt', 'DESC')
      .addOrderBy('n.id', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);

    // Use entity hydration (not getRawMany) so TypeORM timezone conversion
    // produces correct absolute timestamps for relative "time ago" labels.
    const [rows, total] = await qb.getManyAndCount();

    const recipientIds = [...new Set(rows.map((row) => row.recipientId))];
    const recipients =
      recipientIds.length === 0
        ? []
        : await this.users.find({
            where: { id: In(recipientIds) },
            select: ['id', 'email'],
            withDeleted: true,
          });
    const emailById = new Map(recipients.map((u) => [u.id, u.email]));

    return {
      data: rows.map((row) => ({
        id: row.id,
        recipient_id: row.recipientId,
        recipient_email: emailById.get(row.recipientId) ?? null,
        type: row.type,
        title: row.title,
        body: row.body,
        payload: row.payload,
        linked_record_type: row.linkedRecordType,
        linked_record_id: row.linkedRecordId,
        read_state: row.readState,
        read_at: toUtcIso(row.readAt),
        created_at: toUtcIso(row.createdAt) ?? new Date(0).toISOString(),
      })),
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
    if (!found) {
      throw ApiException.notFound('Notification not found');
    }
    await this.repo.softDelete(id);
    await this.audit.recordStandalone({
      actorId,
      action: 'notification.deleted',
      targetType: 'notification',
      targetId: id,
      category: 'notifications',
    });
  }
}
