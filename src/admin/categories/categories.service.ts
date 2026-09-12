import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { ApiException } from '../../common/exceptions/api-exception';
import { Category, type CategoryStatus } from './category.entity';
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/categories.dto';

export interface SerializedCategory {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  description: string | null;
  is_active: Category['isActive'];
  isActive: boolean;
  sort_order: number;
  color: string;
  created_at: Date;
  updated_at: Date;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveStatus(
  isActive?: boolean,
  is_active?: boolean | CategoryStatus,
): CategoryStatus {
  if (isActive !== undefined) {
    return isActive ? 'active' : 'archived';
  }
  if (is_active !== undefined) {
    if (typeof is_active === 'boolean') {
      return is_active ? 'active' : 'archived';
    }
    return is_active;
  }
  return 'active';
}

const toSerialized = (c: Category): SerializedCategory => ({
  id: c.id,
  slug: c.slug,
  name: c.name,
  icon: c.icon ?? null,
  description: c.description,
  is_active: c.isActive,
  isActive: c.isActive === 'active',
  sort_order: c.sortOrder,
  color: c.color,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
  ) {}

  async list(input: {
    search?: string;
    is_active?: 'active' | 'archived';
    page: number;
    limit: number;
  }): Promise<{ data: SerializedCategory[]; total: number }> {
    const qb = this.repo.createQueryBuilder('c').where('c.deleted_at IS NULL');

    if (input.search) {
      qb.andWhere('(c.name LIKE :q OR c.slug LIKE :q)', {
        q: `%${input.search}%`,
      });
    }
    if (input.is_active) {
      qb.andWhere('c.is_active = :s', { s: input.is_active });
    }
    qb.orderBy('c.sort_order', 'ASC')
      .addOrderBy('c.name', 'ASC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);

    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map(toSerialized), total };
  }

  async findActive(): Promise<SerializedCategory[]> {
    const rows = await this.repo.find({
      where: { isActive: 'active', deletedAt: IsNull() },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return rows.map(toSerialized);
  }

  async findOne(id: string): Promise<SerializedCategory> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Category');
    return toSerialized(found);
  }

  async create(input: CreateCategoryDto): Promise<SerializedCategory> {
    let slug = input.slug?.trim() || slugify(input.name) || 'category';
    if (!input.slug) {
      let candidate = slug;
      let counter = 1;
      while (
        await this.repo.findOne({
          where: { slug: candidate },
          withDeleted: true,
        })
      ) {
        candidate = `${slug}-${counter}`;
        counter++;
      }
      slug = candidate;
    } else {
      const existing = await this.repo.findOne({
        where: { slug },
        withDeleted: true,
      });
      if (existing && !existing.deletedAt) {
        throw ApiException.conflict('slug_taken', 'Category slug already exists');
      }
    }

    const status = resolveStatus(input.isActive, input.is_active);

    const row = this.repo.create({
      slug,
      name: input.name,
      icon: input.icon ?? null,
      description: input.description ?? null,
      isActive: status,
      sortOrder: input.sort_order ?? 0,
      color: input.color ?? '#6B7280',
    });
    const saved = await this.repo.save(row);
    return toSerialized(saved);
  }

  async update(
    id: string,
    patch: UpdateCategoryDto,
  ): Promise<SerializedCategory> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Category');

    let slug = patch.slug?.trim();
    if (slug && slug !== found.slug) {
      const dup = await this.repo.findOne({
        where: { slug },
        withDeleted: true,
      });
      if (dup && dup.id !== found.id && !dup.deletedAt) {
        throw ApiException.conflict('slug_taken', 'Slug already in use');
      }
    } else {
      slug = found.slug;
    }

    let status = found.isActive;
    if (patch.isActive !== undefined || patch.is_active !== undefined) {
      status = resolveStatus(patch.isActive, patch.is_active);
    }

    Object.assign(found, {
      slug,
      name: patch.name ?? found.name,
      icon: patch.icon !== undefined ? patch.icon : found.icon,
      description:
        patch.description !== undefined ? patch.description : found.description,
      isActive: status,
      sortOrder: patch.sort_order ?? found.sortOrder,
      color: patch.color ?? found.color,
    });
    const saved = await this.repo.save(found);
    return toSerialized(saved);
  }

  async softDelete(id: string): Promise<void> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Category');
    await this.repo.softRemove(found);
  }
}
