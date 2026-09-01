import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const PAYMENT_METHOD_STATUSES = ['active', 'inactive'] as const;
export type PaymentMethodStatus = (typeof PAYMENT_METHOD_STATUSES)[number];

@Entity('payment_methods')
@Index('idx_payment_methods_code', ['code'], { unique: true })
@Index('idx_payment_methods_is_active', ['isActive'])
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  icon!: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  @Column({ type: 'int', default: 0, name: 'sort_order' })
  sortOrder!: number;

  @Column({
    type: 'varchar',
    length: 120,
    nullable: true,
    name: 'account_hint',
  })
  accountHint!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', nullable: true, name: 'deleted_at' })
  deletedAt!: Date | null;
}
