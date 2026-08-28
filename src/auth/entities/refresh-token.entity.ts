import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('refresh_tokens')
@Index('idx_rt_user', ['userId'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 255, name: 'token_hash' })
  tokenHash!: string;

  @Column({ type: 'datetime', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'datetime', nullable: true, name: 'revoked_at' })
  revokedAt!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ua!: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
