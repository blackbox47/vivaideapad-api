import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('refresh_tokens')
@Index('idx_rt_user', ['userId'])
@Index('idx_rt_family', ['family'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId!: string;

  /**
   * Session family identifier. Issued at sign-in and inherited by every
   * rotated refresh token in the chain. Used to detect token reuse: if any
   * token in a family is presented after it has been revoked, the entire
   * family is revoked (defends against stolen-token replay).
   */
  @Column({ type: 'varchar', length: 36 })
  family!: string;

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
