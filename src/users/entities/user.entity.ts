import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const USER_ROLES = {
  SUPERADMIN: 1,
  ADMINISTRATOR: 2,
  CONTRIBUTOR: 3,
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]; // 1 | 2 | 3

/**
 * Hierarchical RBAC level for each role. A role's level is its rank — a user
 * holding a role with level >= the required role's level is authorized.
 *
 * Used by RolesGuard to interpret `@Roles(X)` as "the user must be X or higher".
 * RolesGuard tests (src/common/guards/roles.guard.spec.ts) lock this contract.
 *
 * Layout:
 *   CONTRIBUTOR (level 1)  — portal/workspace self-service
 *   ADMINISTRATOR (level 2) — operational admin (manages content/users)
 *   SUPERADMIN (level 3)    — super-admin (inherits ADMINISTRATOR)
 */
export const USER_ROLE_LEVEL: Readonly<Record<UserRole, number>> = {
  [USER_ROLES.CONTRIBUTOR]: 1,
  [USER_ROLES.ADMINISTRATOR]: 2,
  [USER_ROLES.SUPERADMIN]: 3,
};

/**
 * Return every role at or above `role`'s level. Used by RolesGuard so that
 * `@Roles(USER_ROLES.ADMINISTRATOR)` also admits SUPERADMIN without callers
 * having to spell both out.
 */
export function rolesAtOrAbove(role: UserRole): UserRole[] {
  const level = USER_ROLE_LEVEL[role];
  return USER_ROLE_VALUES.filter((r) => USER_ROLE_LEVEL[r] >= level);
}

export const USER_ROLE_VALUES: readonly UserRole[] = [
  USER_ROLES.ADMINISTRATOR,
  USER_ROLES.CONTRIBUTOR,
  USER_ROLES.SUPERADMIN,
];

export function isUserRole(v: unknown): v is UserRole {
  return v === 1 || v === 2 || v === 3;
}

export const ACCESS_STATUSES = [
  'active',
  'invited',
  'suspended',
  'pending_review',
] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];

@Entity('users')
@Index('idx_users_email', ['email'], { unique: true })
@Index('idx_users_role', ['role'])
@Index('idx_users_google_id', ['googleId'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'password_hash',
  })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'google_id' })
  googleId!: string | null;

  @Column({
    type: 'varchar',
    length: 120,
    nullable: true,
    name: 'display_name',
  })
  displayName!: string | null;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true, name: 'avatar_url' })
  avatarUrl!: string | null;

  @Column({ type: 'tinyint', default: USER_ROLES.CONTRIBUTOR })
  role!: UserRole;

  @Column({
    type: 'enum',
    enum: ACCESS_STATUSES,
    default: 'invited',
    name: 'access_status',
  })
  accessStatus!: AccessStatus;

  @Column({ type: 'json', nullable: true, name: 'display_prefs' })
  displayPrefs!: Record<string, unknown> | null;

  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
    name: 'verification_token',
  })
  verificationToken!: string | null;

  @Column({
    type: 'datetime',
    nullable: true,
    name: 'verification_token_expires_at',
  })
  verificationTokenExpiresAt!: Date | null;

  @CreateDateColumn({
    type: 'datetime',
    name: 'created_at',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'datetime',
    name: 'updated_at',
  })
  updatedAt!: Date;

  @DeleteDateColumn({
    type: 'datetime',
    nullable: true,
    name: 'deleted_at',
  })
  deletedAt!: Date | null;
}
