import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const PAYOUT_STATUSES = ['pending', 'paid', 'rejected'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

@Entity('payout_requests')
@Index('idx_payout_user', ['userId'])
@Index('idx_payout_status', ['status'])
@Index('idx_payout_created', ['createdAt'])
export class PayoutRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: string;

  @Column({ type: 'enum', enum: PAYOUT_STATUSES, default: 'pending' })
  status!: PayoutStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  method!: string | null;

  @Column({ type: 'json', nullable: true })
  details!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true, name: 'decision_notes' })
  decisionNotes!: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'processing_reference',
  })
  processingReference!: string | null;

  @Column({ type: 'datetime', nullable: true, name: 'processed_at' })
  processedAt!: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'processed_by' })
  processedBy!: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', nullable: true, name: 'deleted_at' })
  deletedAt!: Date | null;
}
