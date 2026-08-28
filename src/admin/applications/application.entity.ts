import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const APPLICATION_STATUSES = [
  'submitted',
  'approved_invited',
  'rejected',
  'needs_info',
  'withdrawn',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

@Entity('applications')
@Index('idx_applications_user', ['userId'])
@Index('idx_applications_category', ['categoryId'])
@Index('idx_applications_status', ['status'])
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 36, name: 'category_id' })
  categoryId!: string;

  @Column({ type: 'varchar', length: 255, name: 'idea_title' })
  ideaTitle!: string;

  @Column({ type: 'text', name: 'idea_description' })
  ideaDescription!: string;

  @Column({ type: 'json', nullable: true })
  attachments!: Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: APPLICATION_STATUSES,
    default: 'submitted',
  })
  status!: ApplicationStatus;

  @Column({ type: 'text', nullable: true, name: 'decision_notes' })
  decisionNotes!: string | null;

  @Column({ type: 'datetime', nullable: true, name: 'decided_at' })
  decidedAt!: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'decided_by' })
  decidedBy!: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    name: 'reference_number',
  })
  referenceNumber!: string | null;

  @Column({ type: 'tinyint', default: 0 })
  consent!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', nullable: true, name: 'deleted_at' })
  deletedAt!: Date | null;
}
