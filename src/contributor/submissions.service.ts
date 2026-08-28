import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import { ApiException } from '../common/exceptions/api-exception';
import { Submission, SubmissionStatus } from './entities/submission.entity';
import {
  CreateSubmissionDto,
  UpdateSubmissionDto,
} from './dto/submissions.dto';

export interface SerializedSubmission {
  id: string;
  user_id: string;
  concept_id: string;
  title: string;
  body: string;
  attachments: Record<string, unknown> | null;
  status: SubmissionStatus;
  risk_signal: Record<string, unknown> | null;
  reward_amount: string | null;
  decision_notes: string | null;
  decided_at: Date | null;
  decided_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const toSerialized = (s: Submission): SerializedSubmission => ({
  id: s.id,
  user_id: s.userId,
  concept_id: s.conceptId,
  title: s.title,
  body: s.body,
  attachments: s.attachments,
  status: s.status,
  risk_signal: s.riskSignal,
  reward_amount: s.rewardAmount,
  decision_notes: s.decisionNotes,
  decided_at: s.decidedAt,
  decided_by: s.decidedBy,
  created_at: s.createdAt,
  updated_at: s.updatedAt,
});

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Submission)
    private readonly repo: Repository<Submission>,
  ) {}

  async list(input: {
    userId: string;
    status?: SubmissionStatus;
    concept_id?: string;
    page: number;
    limit: number;
  }): Promise<{ data: SerializedSubmission[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.deleted_at IS NULL')
      .andWhere('s.user_id = :uid', { uid: input.userId });
    if (input.status) qb.andWhere('s.status = :st', { st: input.status });
    if (input.concept_id)
      qb.andWhere('s.concept_id = :cid', { cid: input.concept_id });
    qb.orderBy('s.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map(toSerialized), total };
  }

  async findOneForUser(
    id: string,
    userId: string,
  ): Promise<SerializedSubmission> {
    const found = await this.repo.findOne({
      where: { id, userId, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Submission');
    return toSerialized(found);
  }

  async create(
    userId: string,
    input: CreateSubmissionDto,
  ): Promise<SerializedSubmission> {
    const row = this.repo.create({
      userId,
      conceptId: input.concept_id,
      title: input.title,
      body: input.body,
      attachments: input.attachments ?? null,
      status: 'draft',
    });
    const saved = await this.repo.save(row);
    return toSerialized(saved);
  }

  async update(
    id: string,
    userId: string,
    patch: UpdateSubmissionDto,
  ): Promise<SerializedSubmission> {
    const found = await this.repo.findOne({
      where: { id, userId, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Submission');
    if (found.status !== 'draft' && found.status !== 'changes_requested') {
      throw ApiException.businessRule(
        'invalid_state',
        `Submission cannot be edited in status ${found.status}`,
      );
    }
    if (patch.title !== undefined) found.title = patch.title;
    if (patch.body !== undefined) found.body = patch.body;
    if (patch.attachments !== undefined) found.attachments = patch.attachments;
    const saved = await this.repo.save(found);
    return toSerialized(saved);
  }

  async submit(id: string, userId: string): Promise<SerializedSubmission> {
    const found = await this.repo.findOne({
      where: { id, userId, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Submission');
    if (found.status !== 'draft' && found.status !== 'changes_requested') {
      throw ApiException.businessRule(
        'invalid_state',
        `Submission cannot be submitted in status ${found.status}`,
      );
    }
    found.status = 'pending_review';
    const saved = await this.repo.save(found);
    return toSerialized(saved);
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const found = await this.repo.findOne({
      where: { id, userId, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Submission');
    if (found.status !== 'draft') {
      throw ApiException.businessRule(
        'invalid_state',
        'Only draft submissions can be deleted',
      );
    }
    await this.repo.softRemove(found);
  }
}
