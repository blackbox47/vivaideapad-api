import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { ApiException } from '../../common/exceptions/api-exception';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Notification } from '../notifications/notification.entity';
import { UsersService } from '../../users/users.service';
import { User, USER_ROLES } from '../../users/entities/user.entity';
import { Category } from '../categories/category.entity';
import { Concept } from '../concepts/concept.entity';
import { Application, ApplicationStatus } from './application.entity';
import type {
  PublicCreateApplicationDto,
  ApplicationDecisionDto,
} from './dto/applications.dto';

export type ApplicantAiRisk = 'Low' | 'Medium' | 'High';

export interface SerializedApplication {
  id: string;
  user_id: string;
  category_id: string;
  idea_title: string;
  idea_description: string;
  attachments: Record<string, unknown> | null;
  status: ApplicationStatus;
  decision_notes: string | null;
  decided_at: Date | null;
  decided_by: string | null;
  reference_number: string | null;
  consent: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SerializedApplicationConcept {
  id: string;
  title: string;
  brief: string;
  reward_budget: string;
  status: string;
  close_date: Date | null;
}

export interface SerializedApplicationDetail extends SerializedApplication {
  name: string;
  email: string;
  topic: string;
  title: string;
  body: string;
  submitted: string;
  source: string;
  risk: ApplicantAiRisk;
  user?: { id: string; name: string; email: string };
  category?: { id: string; name: string; description?: string | null };
  concept?: SerializedApplicationConcept | null;
}

const APPLICATION_SOURCE_WEBSITE = 'Website signup';

const toSerialized = (a: Application): SerializedApplication => ({
  id: a.id,
  user_id: a.userId,
  category_id: a.categoryId,
  idea_title: a.ideaTitle,
  idea_description: a.ideaDescription,
  attachments: a.attachments,
  status: a.status,
  decision_notes: a.decisionNotes,
  decided_at: a.decidedAt,
  decided_by: a.decidedBy,
  reference_number: a.referenceNumber,
  consent: !!a.consent,
  created_at: a.createdAt,
  updated_at: a.updatedAt,
});

/**
 * Prefer a concept in the application category (onboarding, then active),
 * then any onboarding concept so the review drawer can still show a topic card.
 */
export function pickConceptForApplication(
  categoryId: string,
  concepts: Concept[],
): Concept | null {
  const inCategory = concepts.filter((c) => c.categoryId === categoryId);
  return (
    inCategory.find((c) => c.isOnboarding) ??
    inCategory.find((c) => c.status === 'active') ??
    inCategory[0] ??
    concepts.find((c) => c.isOnboarding) ??
    null
  );
}

export function deriveApplicationRisk(text: string): ApplicantAiRisk {
  const length = text.trim().length;
  if (length < 80) return 'High';
  if (length < 220) return 'Medium';
  return 'Low';
}

function toDetail(
  a: Application,
  user: User | null,
  category: Category | null,
  concept: Concept | null = null,
): SerializedApplicationDetail {
  const name = user?.displayName ?? user?.email ?? a.userId;
  const email = user?.email ?? '';
  const topic = concept?.title ?? category?.name ?? 'Uncategorized';
  return {
    ...toSerialized(a),
    name,
    email,
    topic,
    title: a.ideaTitle,
    body: a.ideaDescription,
    submitted: a.createdAt.toISOString(),
    source: APPLICATION_SOURCE_WEBSITE,
    risk: deriveApplicationRisk(`${a.ideaTitle} ${a.ideaDescription}`),
    user: user ? { id: user.id, name, email } : undefined,
    category: category
      ? { id: category.id, name: category.name, description: category.description }
      : undefined,
    concept: concept
      ? {
          id: concept.id,
          title: concept.title,
          brief: concept.brief,
          reward_budget: concept.rewardBudget,
          status: concept.status,
          close_date: concept.closeDate,
        }
      : null,
  };
}

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Application)
    private readonly repo: Repository<Application>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Concept)
    private readonly concepts: Repository<Concept>,
    private readonly usersService: UsersService,
    private readonly audit: AuditEventsService,
    private readonly notify: NotificationsService,
  ) {}

  async publicApply(input: PublicCreateApplicationDto): Promise<{
    reference_number: string;
    application: SerializedApplication;
  }> {
    const email = input.email.toLowerCase();

    // Find or create the applicant user. Applicants start as accessStatus=invited,
    // role=public, and the decision flow promotes them to contributor.
    let user = await this.usersService.findByEmail(email);
    if (!user) {
      const randomPassword = await bcrypt.hash(
        Math.random().toString(36).slice(-12),
        4,
      );
      user = await this.usersService.create({
        email,
        passwordHash: randomPassword,
        displayName: input.display_name,
        role: USER_ROLES.CONTRIBUTOR,
        accessStatus: 'pending_review',
      });
    }

    const referenceNumber = `APP-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '')}-${randomTokenSegment()}`;

    const row = this.repo.create({
      userId: user.id,
      categoryId: input.category_id,
      ideaTitle: input.idea_title,
      ideaDescription: input.idea_description,
      attachments: null,
      status: 'submitted',
      decisionNotes: null,
      decidedAt: null,
      decidedBy: null,
      referenceNumber,
      consent: 1,
    });
    const saved = await this.repo.save(row);

    await this.audit.recordStandalone({
      actorId: user.id,
      action: 'application.submitted',
      targetType: 'application',
      targetId: saved.id,
      context: { email, category_id: input.category_id },
    });

    return {
      reference_number: referenceNumber,
      application: toSerialized(saved),
    };
  }

  async publicStatus(referenceNumber: string): Promise<{ status: string }> {
    const found = await this.repo.findOne({
      where: { referenceNumber, deletedAt: IsNull() },
    });
    if (!found) {
      throw ApiException.notFound('Application');
    }
    return { status: found.status };
  }

  async list(input: {
    status?: ApplicationStatus;
    user_id?: string;
    category_id?: string;
    page: number;
    limit: number;
  }): Promise<{ data: SerializedApplication[]; total: number }> {
    const qb = this.repo.createQueryBuilder('a').where('a.deleted_at IS NULL');
    if (input.status) qb.andWhere('a.status = :s', { s: input.status });
    if (input.user_id) qb.andWhere('a.user_id = :uid', { uid: input.user_id });
    if (input.category_id)
      qb.andWhere('a.category_id = :cid', { cid: input.category_id });
    qb.orderBy('a.created_at', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);
    const [rows, total] = await qb.getManyAndCount();
    return { data: rows.map(toSerialized), total };
  }

  async findOne(id: string): Promise<SerializedApplicationDetail> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Application');

    const [user, category, relatedConcepts] = await Promise.all([
      this.users.findOne({ where: { id: found.userId } }),
      this.categories.findOne({ where: { id: found.categoryId } }),
      this.concepts.find({
        where: [
          { categoryId: found.categoryId, deletedAt: IsNull() },
          { isOnboarding: true, deletedAt: IsNull() },
        ],
      }),
    ]);

    return toDetail(
      found,
      user,
      category,
      pickConceptForApplication(found.categoryId, relatedConcepts),
    );
  }

  async decide(input: {
    id: string;
    actorId: string;
    body: ApplicationDecisionDto;
  }): Promise<SerializedApplication> {
    const { id, actorId, body } = input;

    let savedNotification: Notification | null = null;

    const result = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Application);
      const found = await repo.findOne({
        where: { id, deletedAt: IsNull() },
      });
      if (!found) throw ApiException.notFound('Application');

      let nextStatus: ApplicationStatus;
      switch (body.decision) {
        case 'approve_invite':
          nextStatus = 'approved_invited';
          break;
        case 'reject':
          nextStatus = 'rejected';
          break;
        case 'request_more_info':
          nextStatus = 'needs_info';
          break;
        default:
          throw ApiException.validation('Unknown decision');
      }

      found.status = nextStatus;
      const notes =
        body.decision === 'approve_invite' ? null : (body.notes ?? null);
      found.decisionNotes = notes;
      found.decidedAt = new Date();
      found.decidedBy = actorId;
      const saved = await repo.save(found);

      // approve_invite promotes the user to a real contributor.
      if (body.decision === 'approve_invite') {
        await manager.getRepository(User).update(
          { id: found.userId },
          {
            accessStatus: 'invited',
            role: USER_ROLES.CONTRIBUTOR,
          },
        );
      }

      await this.audit.record(manager, {
        actorId,
        action: `application.${body.decision}`,
        targetType: 'application',
        targetId: found.id,
        category: 'applications',
        context: {
          previous_status: 'submitted',
          new_status: nextStatus,
          notes,
        },
      });

      savedNotification = await this.notify.emit(manager, {
        recipientId: found.userId,
        type: 'application_decision',
        title: titleForDecision(body.decision),
        body: notes ?? undefined,
        linkedRecordType: 'application',
        linkedRecordId: found.id,
        payload: { decision: body.decision, status: nextStatus },
      });

      return toSerialized(saved);
    });

    if (savedNotification) {
      this.notify.publishCreated(savedNotification);
    }
    return result;
  }

  async softDelete(id: string): Promise<void> {
    const found = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!found) throw ApiException.notFound('Application');
    await this.repo.softRemove(found);
  }
}

function titleForDecision(decision: string): string {
  switch (decision) {
    case 'approve_invite':
      return 'Your application has been approved — welcome aboard!';
    case 'reject':
      return 'Your application was not accepted';
    case 'request_more_info':
      return 'We need more information about your application';
    default:
      return 'Application status updated';
  }
}

function randomTokenSegment(length = 4): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export const __testing = {
  toDetail,
  toSerialized,
  pickConceptForApplication,
  deriveApplicationRisk,
};
