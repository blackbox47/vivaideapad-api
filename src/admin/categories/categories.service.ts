import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { ApiException } from '../../common/exceptions/api-exception';
import { Category } from './category.entity';
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/categories.dto';

export interface SerializedCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: Category['isActive'];
  sort_order: number;
  color: string;
  created_at: Date;
  updated_at: Date;
}

const toSerialized = (c: Category): SerializedCategory => ({
  id: c.id,
  slug: c.slug,
  name: c.name,
  description: c.description,
  is_active: c.isActive,
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
    const existing = await this.repo.findOne({
      where: { slug: input.slug },
      withDeleted: true,
    });
    if (existing && !existing.deletedAt) {
      throw ApiException.conflict('slug_taken', 'Category slug already exists');
    }
    const row = this.repo.create({
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      isActive: input.is_active ?? 'active',
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
    if (patch.slug && patch.slug !== found.slug) {
      const dup = await this.repo.findOne({
        where: { slug: patch.slug },
        withDeleted: true,
      });
      if (dup && dup.id !== found.id && !dup.deletedAt) {
        throw ApiException.conflict('slug_taken', 'Slug already in use');
      }
    }
    Object.assign(found, {
      slug: patch.slug ?? found.slug,
      name: patch.name ?? found.name,
      description:
        patch.description !== undefined ? patch.description : found.description,
      isActive: patch.is_active ?? found.isActive,
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
