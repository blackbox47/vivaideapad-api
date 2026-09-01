import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { ApiException } from '../../common/exceptions/api-exception';
import { PaymentMethod } from './payment-method.entity';
import type {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
} from './dto/payment-methods.dto';

export interface SerializedPaymentMethod {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  account_hint: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentMethodOption {
  id: string;
  code: string;
  label: string;
  name: string;
  account_hint: string | null;
  icon: string | null;
}

const toSerialized = (p: PaymentMethod): SerializedPaymentMethod => ({
  id: p.id,
  code: p.code,
  name: p.name,
  description: p.description,
  icon: p.icon,
  is_active: p.isActive,
  sort_order: p.sortOrder,
  account_hint: p.accountHint,
  metadata: p.metadata,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

const toOption = (p: PaymentMethod): PaymentMethodOption => ({
  id: p.code,
  code: p.code,
  label: p.accountHint ? `${p.name} · ${p.accountHint}` : p.name,
  name: p.name,
  account_hint: p.accountHint,
  icon: p.icon,
});

const DEFAULT_METHODS = [
  {
    code: 'bKash',
    name: 'bKash',
    description: 'bKash mobile financial service',
    accountHint: '018•••42',
    isActive: true,
    sortOrder: 1,
  },
  {
    code: 'Nagad',
    name: 'Nagad',
    description: 'Nagad digital financial service of Bangladesh Post Office',
    accountHint: null,
    isActive: true,
    sortOrder: 2,
  },
  {
    code: 'Rocket',
    name: 'Rocket',
    description: 'Dutch-Bangla Bank Rocket mobile banking',
    accountHint: null,
    isActive: true,
    sortOrder: 3,
  },
  {
    code: 'Bank',
    name: 'Bank transfer',
    description: 'Direct electronic bank wire transfer (BEFTN/NPSB)',
    accountHint: null,
    isActive: true,
    sortOrder: 4,
  },
];

@Injectable()
export class PaymentMethodsService implements OnModuleInit {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly repo: Repository<PaymentMethod>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.repo.count();
    if (count === 0) {
      for (const def of DEFAULT_METHODS) {
        const item = this.repo.create(def);
        await this.repo.save(item);
      }
    }
  }

  async list(input: {
    search?: string;
    is_active?: boolean;
    page: number;
    limit: number;
  }): Promise<{ data: SerializedPaymentMethod[]; total: number }> {
    const qb = this.repo.createQueryBuilder('p').where('p.deleted_at IS NULL');

    if (input.search) {
      qb.andWhere(
        '(p.name LIKE :q OR p.code LIKE :q OR p.description LIKE :q)',
        {
          q: `%${input.search}%`,
        },
      );
    }
    if (input.is_active !== undefined) {
      qb.andWhere('p.is_active = :s', { s: input.is_active });
    }
    qb.orderBy('p.sort_order', 'ASC')
      .addOrderBy('p.name', 'ASC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);

    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map(toSerialized), total };
  }

  async listOptions(): Promise<PaymentMethodOption[]> {
    const rows = await this.repo.find({
      where: { isActive: true, deletedAt: IsNull() },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return rows.map(toOption);
  }

  async findOne(id: string): Promise<SerializedPaymentMethod> {
    const found = await this.repo.findOne({
      where: [
        { id, deletedAt: IsNull() },
        { code: id, deletedAt: IsNull() },
      ],
    });
    if (!found) throw ApiException.notFound('PaymentMethod');
    return toSerialized(found);
  }

  async create(
    input: CreatePaymentMethodDto,
  ): Promise<SerializedPaymentMethod> {
    const existing = await this.repo.findOne({
      where: { code: input.code },
      withDeleted: true,
    });
    if (existing && !existing.deletedAt) {
      throw ApiException.conflict(
        'code_taken',
        'Payment method code already exists',
      );
    }
    const row = this.repo.create({
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      isActive: input.is_active ?? true,
      sortOrder: input.sort_order ?? 0,
      accountHint: input.account_hint ?? null,
      metadata: input.metadata ?? null,
    });
    const saved = await this.repo.save(row);
    return toSerialized(saved);
  }

  async update(
    id: string,
    patch: UpdatePaymentMethodDto,
  ): Promise<SerializedPaymentMethod> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('PaymentMethod');

    if (patch.code && patch.code !== found.code) {
      const dup = await this.repo.findOne({
        where: { code: patch.code },
        withDeleted: true,
      });
      if (dup && dup.id !== found.id && !dup.deletedAt) {
        throw ApiException.conflict(
          'code_taken',
          'Payment method code already in use',
        );
      }
    }

    Object.assign(found, {
      code: patch.code ?? found.code,
      name: patch.name ?? found.name,
      description:
        patch.description !== undefined ? patch.description : found.description,
      icon: patch.icon !== undefined ? patch.icon : found.icon,
      isActive:
        patch.is_active !== undefined ? patch.is_active : found.isActive,
      sortOrder:
        patch.sort_order !== undefined ? patch.sort_order : found.sortOrder,
      accountHint:
        patch.account_hint !== undefined
          ? patch.account_hint
          : found.accountHint,
      metadata: patch.metadata !== undefined ? patch.metadata : found.metadata,
    });

    const saved = await this.repo.save(found);
    return toSerialized(saved);
  }

  async softDelete(id: string): Promise<void> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('PaymentMethod');
    await this.repo.softRemove(found);
  }
}
