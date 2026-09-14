import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';

import { ApiException } from '../../common/exceptions/api-exception';
import { Concept, ConceptStatus } from './concept.entity';
import {
  Submission,
  SubmissionStatus,
} from '../../contributor/entities/submission.entity';
import { AuditEventsService } from '../audit-events/audit-events.service';
import type {
  CreateConceptDto,
  UpdateConceptDto,
  BulkConceptActionDto,
} from './dto/concepts.dto';

export interface SerializedConcept {
  id: string;
  category_id: string;
  title: string;
  brief: string;
  reward_budget: string;
  is_onboarding: boolean;
  status: ConceptStatus;
  metadata: Record<string, unknown> | null;
  open_date: Date | null;
  close_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ConceptDeleteResult {
  id: string;
  cascaded_submissions: number;
  cascaded_submission_ids: string[];
}

export interface BulkConceptDeleteResult {
  success: boolean;
  affected: number;
  cascaded_submissions: number;
  cascaded_submission_ids: string[];
}

const toSerialized = (c: Concept): SerializedConcept => ({
  id: c.id,
  category_id: c.categoryId,
  title: c.title,
  brief: c.brief,
  reward_budget: c.rewardBudget,
  is_onboarding: Boolean(c.isOnboarding),
  status: c.status,
  metadata: c.metadata,
  open_date: c.openDate,
  close_date: c.closeDate,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
});

/** Statuses that still have review-work attached and should be cascaded when a topic dies. */
export const CASCADE_STATUSES: SubmissionStatus[] = ['pending_review'];

@Injectable()
export class ConceptsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Concept)
    private readonly repo: Repository<Concept>,
    @InjectRepository(Submission)
    private readonly submissionsRepo: Repository<Submission>,
    private readonly audit: AuditEventsService,
  ) {}

  async list(input: {
    search?: string;
    status?: ConceptStatus;
    category_id?: string;
    is_onboarding?: boolean;
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
    if (input.is_onboarding !== undefined) {
      qb.andWhere('c.is_onboarding = :onboarding', {
        onboarding: input.is_onboarding,
      });
    }
    qb.orderBy('c.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map(toSerialized), total };
  }

  async findPublished(input: {
    category_id?: string;
    is_onboarding?: boolean;
    page: number;
    limit: number;
  }): Promise<{ data: SerializedConcept[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.deleted_at IS NULL')
      .andWhere('c.status IN (:...st)', { st: ['active', 'published'] });
    if (input.category_id) {
      qb.andWhere('c.category_id = :cid', { cid: input.category_id });
    }
    if (input.is_onboarding !== undefined) {
      qb.andWhere('c.is_onboarding = :onboarding', {
        onboarding: input.is_onboarding,
      });
    }
    qb.orderBy('c.open_date', 'DESC')
      .addOrderBy('c.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map(toSerialized), total };
  }

  /**
   * Same as `findPublished`, but excludes any concept the given contributor
   * already has a non-soft-deleted submission for (draft / pending_review /
   * changes_requested / approved / rejected all count). Used by the
   * contributor-facing `/contributor/concepts` endpoint so users only see
   * opportunities they have not yet engaged with.
   *
   * The `NOT EXISTS` sub-query is cheap because of the existing
   * `idx_submissions_concept` + `idx_submissions_user` indexes.
   */
  async findPublishedForContributor(input: {
    userId: string;
    category_id?: string;
    page: number;
    limit: number;
  }): Promise<{ data: SerializedConcept[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.deleted_at IS NULL')
      .andWhere('c.status IN (:...st)', { st: ['active', 'published'] })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM submissions s
          WHERE s.concept_id = c.id
            AND s.user_id = :uid
            AND s.deleted_at IS NULL
        )`,
        { uid: input.userId },
      );
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
      isOnboarding: Boolean(input.is_onboarding ?? false),
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
    if (patch.is_onboarding !== undefined) {
      found.isOnboarding = patch.is_onboarding;
      found.metadata = {
        ...(found.metadata || {}),
        for_new_users: patch.is_onboarding,
      };
    }
    if (patch.status !== undefined) found.status = patch.status;
    if (patch.metadata !== undefined) {
      found.metadata = patch.metadata
        ? { ...(found.metadata || {}), ...patch.metadata }
        : found.metadata;
    }
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
    found.status = 'active';
    found.openDate = found.openDate ?? new Date();
    const saved = await this.repo.save(found);
    return toSerialized(saved);
  }

  async close(id: string): Promise<SerializedConcept> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Concept');
    found.status = 'archived';
    found.closeDate = found.closeDate ?? new Date();
    const saved = await this.repo.save(found);
    return toSerialized(saved);
  }

  /**
   * Soft-delete a topic and cascade-soft-delete any of its submissions that
   * are still under review (`pending_review`). Approved/rejected/changes_requested
   * submissions are preserved for historical record-keeping. Everything happens
   * inside one transaction so partial failures roll back fully.
   */
  async softDelete(input: {
    id: string;
    actorId: string;
  }): Promise<ConceptDeleteResult> {
    const { id, actorId } = input;

    return this.dataSource.transaction(async (manager) => {
      const conceptRepo = manager.getRepository(Concept);
      const submissionRepo = manager.getRepository(Submission);

      const found = await conceptRepo.findOne({
        where: { id, deletedAt: IsNull() },
      });
      if (!found) throw ApiException.notFound('Concept');

      const cascaded = await submissionRepo.find({
        where: {
          conceptId: id,
          status: In(CASCADE_STATUSES),
          deletedAt: IsNull(),
        },
      });

      await conceptRepo.softRemove(found);
      const cascadedIds: string[] = [];
      if (cascaded.length > 0) {
        await submissionRepo.softRemove(cascaded);
        for (const row of cascaded) cascadedIds.push(row.id);
      }

      await this.audit.record(manager, {
        actorId,
        action: 'concept.delete',
        targetType: 'concept',
        targetId: id,
        category: 'concepts',
        context: {
          cascaded_submission_ids: cascadedIds,
          cascaded_submission_count: cascadedIds.length,
          cascading_statuses: CASCADE_STATUSES,
        },
      });

      return {
        id,
        cascaded_submissions: cascadedIds.length,
        cascaded_submission_ids: cascadedIds,
      };
    });
  }

  /**
   * Preview the number of pending_review submissions that will be cascaded
   * if the given concepts are deleted. Non-destructive and cheap.
   */
  async previewCascade(ids: string[]): Promise<{
    cascaded_submissions: number;
  }> {
    if (!ids || ids.length === 0) {
      return { cascaded_submissions: 0 };
    }
    const uniqueIds = Array.from(new Set(ids));
    const count = await this.submissionsRepo.count({
      where: {
        conceptId: In(uniqueIds),
        status: In(CASCADE_STATUSES),
        deletedAt: IsNull(),
      },
    });
    return { cascaded_submissions: count };
  }

  async bulkAction(
    input: BulkConceptActionDto,
    actorId?: string,
  ): Promise<
    | { success: boolean; affected: number; duplicated?: SerializedConcept[] }
    | BulkConceptDeleteResult
  > {
    if (input.action === 'delete' && !actorId) {
      throw ApiException.validation(
        'actorId is required for bulk delete cascade',
      );
    }

    if (!input.ids || input.ids.length === 0) {
      return { success: true, affected: 0 };
    }

    const rows = await this.repo.find({
      where: { id: In(input.ids), deletedAt: IsNull() },
    });

    if (rows.length === 0) {
      return { success: true, affected: 0 };
    }

    switch (input.action) {
      case 'set_status': {
        if (!input.status) {
          throw ApiException.validation(
            'status is required for set_status action',
          );
        }
        const now = new Date();
        const nextStatus = input.status;
        for (const row of rows) {
          row.status = nextStatus;
          if (nextStatus === 'active' && !row.openDate) {
            row.openDate = now;
          } else if (nextStatus === 'archived' && !row.closeDate) {
            row.closeDate = now;
          }
        }
        await this.repo.save(rows);
        return { success: true, affected: rows.length };
      }

      case 'set_for_new_users': {
        const flag = Boolean(input.for_new_users);
        for (const row of rows) {
          row.metadata = {
            ...(row.metadata || {}),
            for_new_users: flag,
          };
          row.isOnboarding = flag;
        }
        await this.repo.save(rows);
        return { success: true, affected: rows.length };
      }

      case 'set_is_onboarding': {
        const flag =
          input.is_onboarding !== undefined
            ? Boolean(input.is_onboarding)
            : true;
        for (const row of rows) {
          row.isOnboarding = flag;
          row.metadata = {
            ...(row.metadata || {}),
            for_new_users: flag,
          };
        }
        await this.repo.save(rows);
        return { success: true, affected: rows.length };
      }

      case 'remove_is_onboarding': {
        for (const row of rows) {
          row.isOnboarding = false;
          row.metadata = {
            ...(row.metadata || {}),
            for_new_users: false,
          };
        }
        await this.repo.save(rows);
        return { success: true, affected: rows.length };
      }

      case 'duplicate': {
        const duplicates = rows.map((row) =>
          this.repo.create({
            categoryId: row.categoryId,
            title: `${row.title} (Copy)`,
            brief: row.brief,
            rewardBudget: row.rewardBudget,
            isOnboarding: row.isOnboarding,
            status: 'draft',
            metadata: row.metadata ? { ...row.metadata } : null,
            openDate: null,
            closeDate: null,
          }),
        );
        const saved = await this.repo.save(duplicates);
        return {
          success: true,
          affected: saved.length,
          duplicated: saved.map(toSerialized),
        };
      }

      case 'delete': {
        const result = await this.cascadeDeleteMany(rows, actorId as string);
        return {
          success: true,
          affected: rows.length,
          cascaded_submissions: result.cascaded_submissions,
          cascaded_submission_ids: result.cascaded_submission_ids,
        };
      }

      default:
        throw ApiException.validation('Unsupported bulk action');
    }
  }

  /**
   * Cascade-soft-delete helper for the bulk path. Performs one transaction
   * that soft-removes every concept in `rows` along with its `pending_review`
   * submissions. One audit event is emitted per concept so the trail is
   * searchable per-row.
   */
  private async cascadeDeleteMany(
    rows: Concept[],
    actorId: string,
  ): Promise<{
    cascaded_submissions: number;
    cascaded_submission_ids: string[];
  }> {
    return this.dataSource.transaction(async (manager) => {
      const conceptRepo = manager.getRepository(Concept);
      const submissionRepo = manager.getRepository(Submission);
      const allCascadedIds: string[] = [];

      for (const row of rows) {
        const cascaded = await submissionRepo.find({
          where: {
            conceptId: row.id,
            status: In(CASCADE_STATUSES),
            deletedAt: IsNull(),
          },
        });
        if (cascaded.length > 0) {
          await submissionRepo.softRemove(cascaded);
          for (const c of cascaded) allCascadedIds.push(c.id);
        }
      }

      await conceptRepo.softRemove(rows);

      for (const row of rows) {
        await this.audit.record(manager, {
          actorId,
          action: 'concept.bulk_delete',
          targetType: 'concept',
          targetId: row.id,
          category: 'concepts',
          context: {
            cascading_statuses: CASCADE_STATUSES,
            batch_size: rows.length,
          },
        });
      }

      return {
        cascaded_submissions: allCascadedIds.length,
        cascaded_submission_ids: allCascadedIds,
      };
    });
  }
}
