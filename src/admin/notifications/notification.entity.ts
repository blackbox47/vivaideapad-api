import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const NOTIFICATION_TYPES = [
  'application_decision',
  'submission_decision',
  'submission_request_revision',
  'payout_status_changed',
  'payout_decision',
  'access_status_changed',
  'broadcast',
  'system',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_READ_STATES = ['unread', 'read'] as const;
export type NotificationReadState = (typeof NOTIFICATION_READ_STATES)[number];

@Entity('notifications')
@Index('idx_notifications_recipient', ['recipientId'])
@Index('idx_notifications_read', ['recipientId', 'readState'])
@Index('idx_notifications_type', ['type'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'recipient_id' })
  recipientId!: string;

  @Column({ type: 'enum', enum: NOTIFICATION_TYPES })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({ type: 'json', nullable: true })
  payload!: Record<string, unknown> | null;

  // Polymorphic ref to the record the notification describes.
  @Column({
    type: 'varchar',
    length: 60,
    nullable: true,
    name: 'linked_record_type',
  })
  linkedRecordType!: string | null;

  @Column({
    type: 'varchar',
    length: 36,
    nullable: true,
    name: 'linked_record_id',
  })
  linkedRecordId!: string | null;

  @Column({
    type: 'enum',
    enum: NOTIFICATION_READ_STATES,
    default: 'unread',
    name: 'read_state',
  })
  readState!: NotificationReadState;

  @Column({ type: 'datetime', nullable: true, name: 'read_at' })
  readAt!: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @DeleteDateColumn({ type: 'datetime', nullable: true, name: 'deleted_at' })
  deletedAt!: Date | null;
}
