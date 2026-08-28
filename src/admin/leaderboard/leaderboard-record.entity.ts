import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const LEADERBOARD_PERIODS = ['all_time', 'monthly', 'weekly'] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

@Entity('leaderboard_records')
@Index('uq_leaderboard_user_period', ['userId', 'period'], { unique: true })
@Index('idx_leaderboard_period_score', ['period', 'score'])
export class LeaderboardRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId!: string;

  @Column({ type: 'enum', enum: LEADERBOARD_PERIODS })
  period!: LeaderboardPeriod;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  score!: string;

  @Column({ type: 'int', default: 0, name: 'submissions_count' })
  submissionsCount!: number;

  @Column({ type: 'int', default: 0 })
  approvals!: number;

  @Column({ type: 'int', default: 0 })
  streak!: number;

  @Column({ type: 'datetime', name: 'last_updated' })
  lastUpdated!: Date;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
