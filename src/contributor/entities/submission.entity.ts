import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const SUBMISSION_STATUSES = [
  'draft',
  'pending_review',
  'changes_requested',
  'approved',
  'rejected',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

@Entity('submissions')
@Index('idx_submissions_user', ['userId'])
@Index('idx_submissions_concept', ['conceptId'])
@Index('idx_submissions_status', ['status'])
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 36, name: 'concept_id' })
  conceptId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'json', nullable: true })
  attachments!: Record<string, unknown>[] | Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: SUBMISSION_STATUSES,
    default: 'draft',
  })
  status!: SubmissionStatus;

  @Column({ type: 'json', nullable: true, name: 'risk_signal' })
  riskSignal!: Record<string, unknown> | null;

  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
    name: 'reward_amount',
  })
  rewardAmount!: string | null;

  @Column({ type: 'text', nullable: true, name: 'decision_notes' })
  decisionNotes!: string | null;

  @Column({ type: 'int', nullable: true, name: 'revision_window_days' })
  revisionWindowDays!: number | null;

  @Column({ type: 'datetime', nullable: true, name: 'revision_due_at' })
  revisionDueAt!: Date | null;

  @Column({ type: 'datetime', nullable: true, name: 'decided_at' })
  decidedAt!: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'decided_by' })
  decidedBy!: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', nullable: true, name: 'deleted_at' })
  deletedAt!: Date | null;
}
