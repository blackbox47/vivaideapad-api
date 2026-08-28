import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { ApiException } from '../../common/exceptions/api-exception';
import { Concept, ConceptStatus } from './concept.entity';
import type { CreateConceptDto, UpdateConceptDto } from './dto/concepts.dto';

export interface SerializedConcept {
  id: string;
  category_id: string;
  title: string;
  brief: string;
  reward_budget: string;
  status: ConceptStatus;
  metadata: Record<string, unknown> | null;
  open_date: Date | null;
  close_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

const toSerialized = (c: Concept): SerializedConcept => ({
  id: c.id,
  category_id: c.categoryId,
  title: c.title,
  brief: c.brief,
  reward_budget: c.rewardBudget,
  status: c.status,
  metadata: c.metadata,
  open_date: c.openDate,
  close_date: c.closeDate,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

@Injectable()
export class ConceptsService {
  constructor(
    @InjectRepository(Concept)
    private readonly repo: Repository<Concept>,
  ) {}

  async list(input: {
    search?: string;
    status?: ConceptStatus;
    category_id?: string;
    page: number;
    limit: number;
  }): Promise<{ data: SerializedConcept[]; total: number }> {
    const qb = this.repo.createQueryBuilder('c').where('c.deleted_at IS NULL');
    if (input.search) {
      qb.andWhere('c.title LIKE :q', { q: `%${input.search}%` });
    }
    if (input.status) {
      qb.andWhere('c.status = :s', { s: input.status });
    }
    if (input.category_id) {
      qb.andWhere('c.category_id = :cid', { cid: input.category_id });
    }
    qb.orderBy('c.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map(toSerialized), total };
  }

  async findPublished(input: {
    category_id?: string;
    page: number;
    limit: number;
  }): Promise<{ data: SerializedConcept[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.deleted_at IS NULL')
      .andWhere('c.status = :st', { st: 'published' });
    if (input.category_id) {
      qb.andWhere('c.category_id = :cid', { cid: input.category_id });
    }
    qb.orderBy('c.open_date', 'DESC')
      .addOrderBy('c.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map(toSerialized), total };
  }

  async findOne(id: string): Promise<SerializedConcept> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Concept');
    return toSerialized(found);
  }

  async create(input: CreateConceptDto): Promise<SerializedConcept> {
    const row = this.repo.create({
      categoryId: input.category_id,
      title: input.title,
      brief: input.brief,
      rewardBudget: String(input.reward_budget ?? 0),
      status: input.status ?? 'draft',
      metadata: input.metadata ?? null,
      openDate: input.open_date ? new Date(input.open_date) : null,
      closeDate: input.close_date ? new Date(input.close_date) : null,
    });
    const saved = await this.repo.save(row);
    return toSerialized(saved);
  }

  async update(
    id: string,
    patch: UpdateConceptDto,
  ): Promise<SerializedConcept> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Concept');
    if (patch.category_id) found.categoryId = patch.category_id;
    if (patch.title !== undefined) found.title = patch.title;
    if (patch.brief !== undefined) found.brief = patch.brief;
    if (patch.reward_budget !== undefined) {
      found.rewardBudget = String(patch.reward_budget);
    }
    if (patch.status !== undefined) found.status = patch.status;
    if (patch.metadata !== undefined) found.metadata = patch.metadata;
    if (patch.open_date !== undefined) {
      found.openDate = patch.open_date ? new Date(patch.open_date) : null;
    }
    if (patch.close_date !== undefined) {
      found.closeDate = patch.close_date ? new Date(patch.close_date) : null;
    }
    const saved = await this.repo.save(found);
    return toSerialized(saved);
  }

  async publish(id: string): Promise<SerializedConcept> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Concept');
    found.status = 'published';
    found.openDate = found.openDate ?? new Date();
    const saved = await this.repo.save(found);
    return toSerialized(saved);
  }

  async close(id: string): Promise<SerializedConcept> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Concept');
    found.status = 'closed';
    found.closeDate = found.closeDate ?? new Date();
    const saved = await this.repo.save(found);
    return toSerialized(saved);
  }

  async softDelete(id: string): Promise<void> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Concept');
    await this.repo.softRemove(found);
  }
}
