import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import {
  AccessStatus,
  User,
  UserRole,
  USER_ROLES,
} from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.users.findOne({
      where: { id, deletedAt: IsNull() },
      withDeleted: false,
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({
      where: { email: email.toLowerCase(), deletedAt: IsNull() },
    });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.users.findOne({
      where: { googleId, deletedAt: IsNull() },
    });
  }

  async create(input: {
    email: string;
    passwordHash?: string | null;
    googleId?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    role?: UserRole;
    accessStatus?: AccessStatus;
  }): Promise<User> {
    const user = this.users.create({
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash ?? null,
      googleId: input.googleId ?? null,
      displayName: input.displayName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      role: input.role ?? USER_ROLES.CONTRIBUTOR,
      accessStatus: input.accessStatus ?? 'invited',
    });
    return this.users.save(user);
  }

  async createGoogleIdentity(input: {
    email: string;
    googleId: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  }): Promise<User> {
    return this.create({
      email: input.email,
      googleId: input.googleId,
      passwordHash: null,
      displayName: input.displayName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      role: USER_ROLES.CONTRIBUTOR,
      accessStatus: 'invited',
    });
  }

  async setGoogleId(id: string, googleId: string | null): Promise<void> {
    await this.users.update({ id }, { googleId });
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.users.update({ id }, { passwordHash });
  }

  async updateProfile(
    id: string,
    patch: { displayName?: string; bio?: string; avatarUrl?: string },
  ): Promise<User> {
    await this.users.update({ id }, patch);
    const found = await this.findById(id);
    if (!found) throw new Error('user disappeared mid-update');
    return found;
  }

  async updateDisplayPrefs(
    id: string,
    prefs: Record<string, unknown>,
  ): Promise<User> {
    await this.users.update({ id }, { displayPrefs: prefs as never });
    const found = await this.findById(id);
    if (!found) throw new Error('user disappeared mid-update');
    return found;
  }

  async setAccessStatus(id: string, accessStatus: AccessStatus): Promise<User> {
    await this.users.update({ id }, { accessStatus });
    const found = await this.findById(id);
    if (!found) throw new Error('user disappeared mid-update');
    return found;
  }

  async setRole(id: string, role: UserRole): Promise<User> {
    await this.users.update({ id }, { role });
    const found = await this.findById(id);
    if (!found) throw new Error('user disappeared mid-update');
    return found;
  }
}
