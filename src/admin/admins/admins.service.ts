import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

import { ApiException } from '../../common/exceptions/api-exception';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { User, USER_ROLES, UserRole } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { CreateAdminDto, UpdateAdminDto } from './dto/admins.dto';

export interface SerializedAdminAccount {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  access_status: string;
  created_at: Date;
  updated_at: Date;
}

const toSerialized = (u: User): SerializedAdminAccount => ({
  id: u.id,
  email: u.email,
  display_name: u.displayName,
  role: u.role,
  access_status: u.accessStatus,
  created_at: u.createdAt,
  updated_at: u.updatedAt,
});

@Injectable()
export class AdminsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly usersService: UsersService,
    private readonly audit: AuditEventsService,
  ) {}

  async list(input: {
    search?: string;
    page: number;
    limit: number;
  }): Promise<{ data: SerializedAdminAccount[]; total: number }> {
    const qb = this.users
      .createQueryBuilder('u')
      .where('u.deleted_at IS NULL')
      .andWhere('u.role IN (:...roles)', {
        roles: [USER_ROLES.ADMINISTRATOR, USER_ROLES.SUPERADMIN],
      });
    if (input.search) {
      qb.andWhere('(u.email LIKE :s OR u.display_name LIKE :s)', {
        s: `%${input.search}%`,
      });
    }
    qb.orderBy('u.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map(toSerialized), total };
  }

  async findOne(id: string): Promise<SerializedAdminAccount> {
    const found = await this.usersService.findById(id);
    if (
      !found ||
      (found.role !== USER_ROLES.ADMINISTRATOR &&
        found.role !== USER_ROLES.SUPERADMIN)
    ) {
      throw ApiException.notFound('Administrator');
    }
    return toSerialized(found);
  }

  async create(input: {
    actorId: string;
    body: CreateAdminDto;
  }): Promise<SerializedAdminAccount> {
    const existing = await this.usersService.findByEmail(input.body.email);
    if (existing) {
      throw ApiException.conflict('email_in_use', 'Email already in use');
    }
    const passwordHash = await bcrypt.hash(input.body.password, 10);

    const saved = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      const row = repo.create({
        email: input.body.email.toLowerCase(),
        passwordHash,
        displayName: input.body.display_name ?? null,
        role: USER_ROLES.ADMINISTRATOR,
        accessStatus: 'active',
      });
      const inserted = await repo.save(row);
      await this.audit.record(manager, {
        actorId: input.actorId,
        action: 'admin.created',
        targetType: 'user',
        targetId: inserted.id,
        category: 'admins',
        context: { email: inserted.email },
      });
      return inserted;
    });

    return toSerialized(saved);
  }

  async update(input: {
    id: string;
    actorId: string;
    body: UpdateAdminDto;
  }): Promise<SerializedAdminAccount> {
    const found = await this.usersService.findById(input.id);
    if (
      !found ||
      (found.role !== USER_ROLES.ADMINISTRATOR &&
        found.role !== USER_ROLES.SUPERADMIN)
    ) {
      throw ApiException.notFound('Administrator');
    }

    const patch: {
      displayName?: string;
      role?: UserRole;
      accessStatus?: string;
      passwordHash?: string;
    } = {};
    if (input.body.display_name !== undefined) {
      patch.displayName = input.body.display_name;
    }
    if (input.body.role !== undefined) {
      patch.role = input.body.role;
    }
    if (input.body.access_status !== undefined) {
      patch.accessStatus = input.body.access_status;
    }
    if (input.body.password) {
      patch.passwordHash = await bcrypt.hash(input.body.password, 10);
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      if (Object.keys(patch).length > 0) {
        await manager
          .getRepository(User)
          .update({ id: input.id }, patch as never);
      }
      await this.audit.record(manager, {
        actorId: input.actorId,
        action: 'admin.updated',
        targetType: 'user',
        targetId: input.id,
        category: 'admins',
        context: { fields: Object.keys(patch) },
      });
      const refetched = await manager
        .getRepository(User)
        .findOne({ where: { id: input.id } });
      if (!refetched) {
        throw ApiException.notFound('Administrator');
      }
      return refetched;
    });

    return toSerialized(updated);
  }

  async softDelete(input: { id: string; actorId: string }): Promise<void> {
    const found = await this.usersService.findById(input.id);
    if (!found || found.role !== USER_ROLES.ADMINISTRATOR) {
      throw ApiException.notFound('Administrator');
    }
    if (found.id === input.actorId) {
      throw ApiException.forbidden(
        'cannot_remove_self',
        'You cannot remove your own admin access.',
      );
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).softRemove(found);
      await this.audit.record(manager, {
        actorId: input.actorId,
        action: 'admin.deleted',
        targetType: 'user',
        targetId: input.id,
        category: 'admins',
        context: { email: found.email },
      });
    });
  }
}
