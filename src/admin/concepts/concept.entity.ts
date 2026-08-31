import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const CONCEPT_STATUSES = [
  'draft',
  'scheduled',
  'active',
  'archived',
] as const;
export type ConceptStatus = (typeof CONCEPT_STATUSES)[number];

@Entity('concepts')
@Index('idx_concepts_status', ['status'])
@Index('idx_concepts_category', ['categoryId'])
export class Concept {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'category_id' })
  categoryId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  brief!: string;

  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    name: 'reward_budget',
    default: 0,
  })
  rewardBudget!: string;

  @Column({
    type: 'enum',
    enum: CONCEPT_STATUSES,
    default: 'draft',
  })
  status!: ConceptStatus;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'datetime', nullable: true, name: 'open_date' })
  openDate!: Date | null;

  @Column({ type: 'datetime', nullable: true, name: 'close_date' })
  closeDate!: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', nullable: true, name: 'deleted_at' })
  deletedAt!: Date | null;
}
