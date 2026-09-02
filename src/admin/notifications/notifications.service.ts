import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThanOrEqual, Repository } from 'typeorm';

import {
  Notification,
  NotificationReadState,
  NotificationType,
} from './notification.entity';
import {
  NotificationsStreamService,
  WireNotification,
} from './notifications-stream.service';

export interface EmitNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string;
  payload?: Record<string, unknown>;
  linkedRecordType?: string;
  linkedRecordId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    private readonly stream: NotificationsStreamService,
  ) {}

  /**
   * Insert a notification row inside an existing transaction. Used by every
   * decision flow so the notification commit/rolls-back atomically with the
   * status flip + ledger write.
   *
   * Callers MUST call `publishCreated(saved)` AFTER the surrounding
   * transaction commits. The service intentionally does not publish inside
   * the TX — that would risk pushing a notification for a row that ends up
   * rolled back.
   */
  async emit(
    manager: EntityManager,
    input: EmitNotificationInput,
  ): Promise<Notification> {
    const repo = manager.getRepository(Notification);
    const row = repo.create({
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      payload: input.payload ?? null,
      linkedRecordType: input.linkedRecordType ?? null,
      linkedRecordId: input.linkedRecordId ?? null,
      readState: 'unread',
      readAt: null,
    });
    return repo.save(row);
  }

  async emitStandalone(input: EmitNotificationInput): Promise<Notification> {
    const row = this.repo.create({
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      payload: input.payload ?? null,
      linkedRecordType: input.linkedRecordType ?? null,
      linkedRecordId: input.linkedRecordId ?? null,
      readState: 'unread',
      readAt: null,
    });
    const saved = await this.repo.save(row);
    this.stream.publishTo(saved.recipientId, {
      type: 'created',
      notification: this.toWire(saved),
    });
    return saved;
  }

  async listForRecipient(input: {
    recipientId: string;
    read_state?: NotificationReadState;
    page: number;
    limit: number;
  }): Promise<{ data: Notification[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('n')
      .where('n.recipient_id = :rid', { rid: input.recipientId })
      .andWhere('n.deleted_at IS NULL');
    if (input.read_state) {
      qb.andWhere('n.read_state = :rs', { rs: input.read_state });
    }
    qb.orderBy('n.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async markRead(input: {
    id: string;
    recipientId: string;
  }): Promise<Notification> {
    const found = await this.repo.findOne({
      where: {
        id: input.id,
        recipientId: input.recipientId,
        deletedAt: IsNull(),
      },
    });
    if (!found) {
      throw new Error('notification not found');
    }
    if (found.readState === 'read') return found;
    found.readState = 'read';
    found.readAt = new Date();
    const saved = await this.repo.save(found);
    this.stream.publishTo(saved.recipientId, {
      type: 'updated',
      notification: this.toWire(saved),
    });
    return saved;
  }

  async markAllRead(recipientId: string): Promise<{ updated: number }> {
    const result = await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ readState: 'read', readAt: () => 'CURRENT_TIMESTAMP' })
      .where('recipient_id = :rid', { rid: recipientId })
      .andWhere('read_state = :rs', { rs: 'unread' })
      .andWhere('deleted_at IS NULL')
      .execute();
    const updated = result.affected ?? 0;

    if (updated > 0) {
      // Fan out one updated event per row that just transitioned so the SPA
      // can update its cache row-by-row. The threshold of "since 60s ago" is
      // a reasonable window — bulk reads are user-initiated, so the rows
      // that flipped should be the most recently read ones.
      const cutoff = new Date(Date.now() - 60_000);
      const flipped = await this.repo.find({
        where: {
          recipientId,
          readState: 'read',
          readAt: MoreThanOrEqual(cutoff),
        },
      });
      for (const row of flipped) {
        this.stream.publishTo(row.recipientId, {
          type: 'updated',
          notification: this.toWire(row),
        });
      }
    }

    return { updated };
  }

  /**
   * Publish a `created` event for a notification that has just been written
   * inside a parent transaction. MUST be called after the surrounding
   * transaction commits — passing a not-yet-committed row would leak
   * notifications for rolled-back work.
   */
  publishCreated(saved: Notification): void {
    this.stream.publishTo(saved.recipientId, {
      type: 'created',
      notification: this.toWire(saved),
    });
  }

  /**
   * Publish an `updated` event for a notification whose state changed
   * (typically read-state). Call after the underlying repo.save / TX commit.
   */
  publishUpdated(saved: Notification): void {
    this.stream.publishTo(saved.recipientId, {
      type: 'updated',
      notification: this.toWire(saved),
    });
  }

  /** Project a TypeORM entity to the wire shape consumed by SSE clients. */
  toWire(n: Notification): WireNotification {
    return {
      id: n.id,
      recipient_id: n.recipientId,
      type: n.type,
      title: n.title,
      body: n.body,
      payload: n.payload,
      linked_record_type: n.linkedRecordType,
      linked_record_id: n.linkedRecordId,
      read_state: n.readState,
      read_at: n.readAt ? n.readAt.toISOString() : null,
      created_at: n.createdAt.toISOString(),
    };
  }
}
