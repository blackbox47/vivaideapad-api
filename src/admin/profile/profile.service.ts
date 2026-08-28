import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { ApiException } from '../../common/exceptions/api-exception';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { User, UserRole } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { AdminUsersService } from '../users/admin-users.service';

export interface SerializedPayoutMethod {
  type: string;
  account: string;
  label: string;
}

export interface SerializedNotifications {
  email: boolean;
  in_app: boolean;
}

export interface SerializedProfile {
  id: string;
  email: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  phone: string | null;
  public_display: string;
  notifications: SerializedNotifications;
  payout_method: SerializedPayoutMethod;
  role: UserRole;
  access_status: string;
  display_prefs: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

const DEFAULT_PAYOUT: SerializedPayoutMethod = {
  type: 'bkash',
  account: '',
  label: 'bKash · 018•••42',
};

function asPrefs(value: Record<string, unknown> | null): Record<string, unknown> {
  return value ? { ...value } : {};
}

function readPayout(prefs: Record<string, unknown>): SerializedPayoutMethod {
  const raw = prefs.payout_method;
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_PAYOUT;
  }
  const row = raw as Record<string, unknown>;
  return {
    type: typeof row.type === 'string' ? row.type : DEFAULT_PAYOUT.type,
    account: typeof row.account === 'string' ? row.account : '',
    label: typeof row.label === 'string' ? row.label : DEFAULT_PAYOUT.label,
  };
}

function readNotifications(
  prefs: Record<string, unknown>,
): SerializedNotifications {
  const raw = prefs.notifications;
  if (!raw || typeof raw !== 'object') {
    return { email: true, in_app: true };
  }
  const row = raw as Record<string, unknown>;
  return {
    email: row.email !== false && row.email_notifications !== false,
    in_app: row.in_app !== false && row.inApp !== false,
  };
}

@Injectable()
export class ProfileService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly audit: AuditEventsService,
    private readonly adminUsers: AdminUsersService,
  ) {}

  async getSelf(userId: string): Promise<SerializedProfile> {
    const found = await this.usersService.findById(userId);
    if (!found) throw ApiException.notFound('User');
    return this.serialize(found);
  }

  async updateSelf(input: {
    userId: string;
    body: {
      display_name?: string;
      name?: string;
      bio?: string;
      avatar_url?: string;
      phone?: string;
      public_display?: string;
      publicDisplay?: string;
    };
  }): Promise<SerializedProfile> {
    const found = await this.usersService.findById(input.userId);
    if (!found) throw ApiException.notFound('User');

    const displayName = input.body.display_name ?? input.body.name;
    const publicDisplay =
      input.body.public_display ?? input.body.publicDisplay;
    const patch: {
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
      displayPrefs?: Record<string, unknown>;
    } = {};
    if (displayName !== undefined) {
      patch.displayName = displayName;
    }
    if (input.body.bio !== undefined) {
      patch.bio = input.body.bio;
    }
    if (
      input.body.avatar_url !== undefined &&
      input.body.avatar_url.startsWith('http') &&
      input.body.avatar_url.length <= 512
    ) {
      patch.avatarUrl = input.body.avatar_url;
    }

    const prefs = asPrefs(found.displayPrefs);
    let prefsChanged = false;
    if (input.body.phone !== undefined) {
      prefs.phone = input.body.phone;
      prefsChanged = true;
    }
    if (publicDisplay !== undefined) {
      prefs.public_display = publicDisplay;
      prefsChanged = true;
    }
    if (prefsChanged) {
      patch.displayPrefs = prefs;
    }

    await this.dataSource.transaction(async (manager) => {
      if (Object.keys(patch).length > 0) {
        await manager
          .getRepository(User)
          .update({ id: input.userId }, patch as never);
      }
      await this.audit.record(manager, {
        actorId: input.userId,
        action: 'profile.self_updated',
        targetType: 'user',
        targetId: input.userId,
        category: 'profile',
        context: { fields: Object.keys(patch) },
      });
    });

    const updated = await this.usersService.findById(input.userId);
    if (!updated) throw ApiException.notFound('User');
    return this.serialize(updated);
  }

  async updatePassword(input: {
    userId: string;
    body: {
      password?: string;
      new_password?: string;
      current_password?: string;
    };
  }): Promise<{ updatedAt: string }> {
    const found = await this.usersService.findById(input.userId);
    if (!found) throw ApiException.notFound('User');

    const newPass = input.body.password ?? input.body.new_password;
    if (!newPass || newPass.length < 8) {
      throw ApiException.validation('Password must be at least 8 characters');
    }

    if (input.body.current_password) {
      const matches = await bcrypt.compare(
        input.body.current_password,
        found.passwordHash,
      );
      if (!matches) {
        throw ApiException.validation('Current password is incorrect');
      }
    }

    const hash = await bcrypt.hash(newPass, 10);
    await this.usersService.setPasswordHash(input.userId, hash);

    await this.dataSource.transaction(async (manager) => {
      await this.audit.record(manager, {
        actorId: input.userId,
        action: 'profile.password_updated',
        targetType: 'user',
        targetId: input.userId,
        category: 'profile',
      });
    });

    return { updatedAt: new Date().toISOString() };
  }

  async getDisplayPrefs(
    userId: string,
  ): Promise<{ display_prefs: Record<string, unknown> | null }> {
    const found = await this.usersService.findById(userId);
    if (!found) throw ApiException.notFound('User');
    return { display_prefs: found.displayPrefs };
  }

  async updateDisplayPrefs(input: {
    userId: string;
    prefs: Record<string, unknown>;
  }): Promise<{ display_prefs: Record<string, unknown> }> {
    const found = await this.usersService.findById(input.userId);
    if (!found) throw ApiException.notFound('User');

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(User)
        .update({ id: input.userId }, { displayPrefs: input.prefs as never });
      await this.audit.record(manager, {
        actorId: input.userId,
        action: 'profile.display_prefs_updated',
        targetType: 'user',
        targetId: input.userId,
        category: 'profile',
        context: { keys: Object.keys(input.prefs) },
      });
    });

    return { display_prefs: input.prefs };
  }

  async updateNotifications(input: {
    userId: string;
    email?: boolean;
    inApp?: boolean;
  }): Promise<SerializedNotifications> {
    const found = await this.usersService.findById(input.userId);
    if (!found) throw ApiException.notFound('User');

    const prefs = asPrefs(found.displayPrefs);
    const current = readNotifications(prefs);
    const next = {
      email: input.email ?? current.email,
      in_app: input.inApp ?? current.in_app,
    };
    prefs.notifications = next;

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(User)
        .update({ id: input.userId }, { displayPrefs: prefs as never });
      await this.audit.record(manager, {
        actorId: input.userId,
        action: 'profile.notifications_updated',
        targetType: 'user',
        targetId: input.userId,
        category: 'profile',
        context: next,
      });
    });

    return next;
  }

  async updatePayoutMethod(input: {
    userId: string;
    method?: string;
    label?: string;
    account?: string;
  }): Promise<SerializedPayoutMethod> {
    const found = await this.usersService.findById(input.userId);
    if (!found) throw ApiException.notFound('User');

    const prefs = asPrefs(found.displayPrefs);
    const current = readPayout(prefs);
    const next: SerializedPayoutMethod = {
      type: (input.method ?? current.type).toLowerCase(),
      account: input.account ?? current.account,
      label: input.label ?? current.label,
    };
    prefs.payout_method = next;

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(User)
        .update({ id: input.userId }, { displayPrefs: prefs as never });
      await this.audit.record(manager, {
        actorId: input.userId,
        action: 'profile.payout_method_updated',
        targetType: 'user',
        targetId: input.userId,
        category: 'profile',
        context: { ...next },
      });
    });

    return next;
  }

  async updateAvatar(input: {
    userId: string;
    dataUrl?: string;
    avatarUrl?: string;
  }): Promise<SerializedProfile> {
    const found = await this.usersService.findById(input.userId);
    if (!found) throw ApiException.notFound('User');

    const candidate = input.avatarUrl ?? input.dataUrl ?? '';
    if (candidate.startsWith('http') && candidate.length <= 512) {
      await this.dataSource.transaction(async (manager) => {
        await manager
          .getRepository(User)
          .update({ id: input.userId }, { avatarUrl: candidate });
        await this.audit.record(manager, {
          actorId: input.userId,
          action: 'profile.avatar_updated',
          targetType: 'user',
          targetId: input.userId,
          category: 'profile',
        });
      });
    }

    const updated = await this.usersService.findById(input.userId);
    if (!updated) throw ApiException.notFound('User');
    return this.serialize(updated);
  }

  private serialize(u: User): SerializedProfile {
    const prefs = asPrefs(u.displayPrefs);
    return {
      id: u.id,
      email: u.email,
      display_name: u.displayName,
      bio: u.bio,
      avatar_url: u.avatarUrl,
      phone: typeof prefs.phone === 'string' ? prefs.phone : null,
      public_display:
        typeof prefs.public_display === 'string'
          ? prefs.public_display
          : 'Public name',
      notifications: readNotifications(prefs),
      payout_method: readPayout(prefs),
      role: u.role,
      access_status: u.accessStatus,
      display_prefs: u.displayPrefs,
      created_at: u.createdAt,
      updated_at: u.updatedAt,
    };
  }
}
