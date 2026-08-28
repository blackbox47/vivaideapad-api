import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const LEDGER_ENTRY_TYPES = [
  'reward_credit',
  'payout_hold',
  'payout_reversal',
  'manual_adjustment',
  'fee',
] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export const LEDGER_ENTRY_STATUSES = ['pending', 'posted', 'reversed'] as const;
export type LedgerEntryStatus = (typeof LEDGER_ENTRY_STATUSES)[number];

@Entity('wallet_ledger_entries')
@Index('idx_ledger_user', ['userId'])
@Index('idx_ledger_reference', ['reference'])
@Index('idx_ledger_status', ['status'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId!: string;

  @Column({ type: 'enum', enum: LEDGER_ENTRY_TYPES })
  type!: LedgerEntryType;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: string;

  @Column({
    type: 'enum',
    enum: LEDGER_ENTRY_STATUSES,
    default: 'posted',
  })
  status!: LedgerEntryStatus;

  @Column({ type: 'varchar', length: 120 })
  reference!: string;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'datetime', nullable: true, name: 'posted_at' })
  postedAt!: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
