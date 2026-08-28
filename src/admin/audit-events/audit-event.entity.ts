import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_events')
@Index('idx_audit_actor', ['actorId'])
@Index('idx_audit_target', ['targetType', 'targetId'])
@Index('idx_audit_action', ['action'])
@Index('idx_audit_occurred', ['occurredAt'])
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'actor_id' })
  actorId!: string;

  @Column({ type: 'varchar', length: 120 })
  action!: string;

  @Column({ type: 'varchar', length: 60, name: 'target_type' })
  targetType!: string;

  @Column({ type: 'varchar', length: 36, name: 'target_id' })
  targetId!: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  category!: string | null;

  @Column({ type: 'json', nullable: true })
  context!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'datetime', name: 'occurred_at' })
  occurredAt!: Date;
}
