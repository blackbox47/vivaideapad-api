import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { ApiException } from '../../common/exceptions/api-exception';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserRole } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import {
  AdminUserListQueryDto,
  UpdateAccessStatusDto,
  UpdateRoleDto,
} from './dto/admin-users.dto';

export interface SerializedAdminUser {
  id: string;
  email: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  role: UserRole;
  access_status: string;
  display_prefs: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

const toSerialized = (u: User): SerializedAdminUser => ({
  id: u.id,
  email: u.email,
  display_name: u.displayName,
  bio: u.bio,
  avatar_url: u.avatarUrl,
  role: u.role,
  access_status: u.accessStatus,
  display_prefs: u.displayPrefs,
  created_at: u.createdAt,
  updated_at: u.updatedAt,
});

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly usersService: UsersService,
    private readonly audit: AuditEventsService,
    private readonly notify: NotificationsService,
  ) {}

  async list(
    query: AdminUserListQueryDto,
    page: number,
    limit: number,
  ): Promise<{ data: SerializedAdminUser[]; total: number }> {
    const qb = this.users.createQueryBuilder('u').where('u.deleted_at IS NULL');
    if (query.role) qb.andWhere('u.role = :role', { role: query.role });
    if (query.access_status) {
      qb.andWhere('u.access_status = :as', { as: query.access_status });
    }
    if (query.search) {
      qb.andWhere('(u.email LIKE :s OR u.display_name LIKE :s)', {
        s: `%${query.search}%`,
      });
    }
    qb.orderBy('u.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map(toSerialized), total };
  }

  async findOne(id: string): Promise<SerializedAdminUser> {
    const found = await this.usersService.findById(id);
    if (!found) throw ApiException.notFound('User');
    return toSerialized(found);
  }

  async updateProfile(input: {
    id: string;
    actorId: string;
    body: { display_name?: string; bio?: string; avatar_url?: string };
  }): Promise<SerializedAdminUser> {
    const found = await this.usersService.findById(input.id);
    if (!found) throw ApiException.notFound('User');

    const patch: { displayName?: string; bio?: string; avatarUrl?: string } =
      {};
    if (input.body.display_name !== undefined) {
      patch.displayName = input.body.display_name;
    }
    if (input.body.bio !== undefined) {
      patch.bio = input.body.bio;
    }
    if (input.body.avatar_url !== undefined) {
      patch.avatarUrl = input.body.avatar_url;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).update({ id: input.id }, patch);
      await this.audit.record(manager, {
        actorId: input.actorId,
        action: 'user.profile_updated',
        targetType: 'user',
        targetId: input.id,
        category: 'users',
        context: { fields: Object.keys(patch) },
      });
    });

    const updated = await this.usersService.findById(input.id);
    if (!updated) throw ApiException.notFound('User');
    return toSerialized(updated);
  }

  async updateAccessStatus(input: {
    id: string;
    actorId: string;
    body: UpdateAccessStatusDto;
  }): Promise<SerializedAdminUser> {
    const found = await this.usersService.findById(input.id);
    if (!found) throw ApiException.notFound('User');
    const previous = found.accessStatus;

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(User)
        .update({ id: input.id }, { accessStatus: input.body.access_status });
      await this.audit.record(manager, {
        actorId: input.actorId,
        action: 'user.access_status_updated',
        targetType: 'user',
        targetId: input.id,
        category: 'users',
        context: {
          previous_status: previous,
          new_status: input.body.access_status,
          reason: input.body.reason ?? null,
        },
      });
      await this.notify.emit(manager, {
        recipientId: input.id,
        type: 'access_status_changed',
        title: titleForAccessStatus(input.body.access_status),
        body: input.body.reason ?? undefined,
        linkedRecordType: 'user',
        linkedRecordId: input.id,
        payload: {
          previous_status: previous,
          new_status: input.body.access_status,
        },
      });
    });

    const updated = await this.usersService.findById(input.id);
    if (!updated) throw ApiException.notFound('User');
    return toSerialized(updated);
  }

  async updateRole(input: {
    id: string;
    actorId: string;
    body: UpdateRoleDto;
  }): Promise<SerializedAdminUser> {
    const found = await this.usersService.findById(input.id);
    if (!found) throw ApiException.notFound('User');
    const previous = found.role;

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(User)
        .update({ id: input.id }, { role: input.body.role });
      await this.audit.record(manager, {
        actorId: input.actorId,
        action: 'user.role_updated',
        targetType: 'user',
        targetId: input.id,
        category: 'users',
        context: {
          previous_role: previous,
          new_role: input.body.role,
          reason: input.body.reason ?? null,
        },
      });
      // Notify user only if the role change is material; skipping notify for
      // self-initiated administrative housekeeping would be confusing.
      if (input.actorId !== input.id) {
        await this.notify.emit(manager, {
          recipientId: input.id,
          type: 'system',
          title: `Your role has been updated to ${input.body.role}`,
          body: input.body.reason ?? undefined,
          linkedRecordType: 'user',
          linkedRecordId: input.id,
          payload: { previous_role: previous, new_role: input.body.role },
        });
      }
    });

    const updated = await this.usersService.findById(input.id);
    if (!updated) throw ApiException.notFound('User');
    return toSerialized(updated);
  }

  async softDelete(input: { id: string; actorId: string }): Promise<void> {
    const found = await this.usersService.findById(input.id);
    if (!found) throw ApiException.notFound('User');
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).softRemove(found);
      await this.audit.record(manager, {
        actorId: input.actorId,
        action: 'user.deleted',
        targetType: 'user',
        targetId: input.id,
        category: 'users',
        context: { email: found.email },
      });
    });
  }
}

function titleForAccessStatus(status: string): string {
  switch (status) {
    case 'active':
      return 'Your access is now active';
    case 'invited':
      return 'You have been invited — please sign in';
    case 'suspended':
      return 'Your access has been suspended';
    case 'pending_review':
      return 'Your account is pending review';
    default:
      return 'Your access status has been updated';
  }
}
