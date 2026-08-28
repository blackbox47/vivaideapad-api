import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import {
  Notification,
  NotificationReadState,
  NotificationType,
} from './notification.entity';

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
  ) {}

  /**
   * Insert a notification row inside an existing transaction. Used by every
   * decision flow so the notification commit/rolls-back atomically with the
   * status flip + ledger write.
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
    return this.repo.save(row);
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
    return this.repo.save(found);
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
    return { updated: result.affected ?? 0 };
  }
}
