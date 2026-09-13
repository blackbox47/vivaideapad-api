import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable, interval, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request } from 'express';

import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  buildPaginationMeta,
  parsePagination,
} from '../common/utils/pagination';
import { ApiException } from '../common/exceptions/api-exception';
import { ConceptsService } from '../admin/concepts/concepts.service';
import { SubmissionsService } from './submissions.service';
import { WalletService } from './wallet.service';
import { NotificationsService } from '../admin/notifications/notifications.service';
import { NotificationsStreamService } from '../admin/notifications/notifications-stream.service';
import { UploadsService } from '../uploads/uploads.service';
import {
  CreateSubmissionDto,
  SubmissionIdParamDto,
  SubmissionListQueryDto,
  UpdateSubmissionDto,
} from './dto/submissions.dto';
import { LedgerListQueryDto } from './dto/ledger.dto';
import { PayoutsService } from '../admin/payouts/payouts.service';
import { CreatePayoutDto } from '../admin/payouts/dto/payouts.dto';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../admin/notifications/notification.entity';
import { USER_ROLES } from '../users/entities/user.entity';

import { LeaderboardService } from '../admin/leaderboard/leaderboard.service';
import { Submission } from './entities/submission.entity';

const ContributorLeaderboardQuerySchema = z.object({
  period: z.enum(['all_time', 'monthly', 'weekly']).default('all_time'),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
class ContributorLeaderboardQueryDto extends createZodDto(
  ContributorLeaderboardQuerySchema,
) {}

const ContributorPayoutListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});
class ContributorPayoutListQueryDto extends createZodDto(
  ContributorPayoutListQuerySchema,
) {}

const ContributorConceptsListQuerySchema = z.object({
  category_id: z.uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});
class ContributorConceptsListQueryDto extends createZodDto(
  ContributorConceptsListQuerySchema,
) {}

const NotificationIdParamSchema = z.object({ id: z.uuid() });
class NotificationIdParamDto extends createZodDto(NotificationIdParamSchema) {}

const NotificationsListQuerySchema = z.object({
  read_state: z.enum(['unread', 'read']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});
class NotificationsListQueryDto extends createZodDto(
  NotificationsListQuerySchema,
) {}

@ApiTags('Contributor')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.CONTRIBUTOR)
@Controller(['contributor', 'creator'])
export class ContributorController {
  constructor(
    private readonly submissions: SubmissionsService,
    private readonly wallet: WalletService,
    private readonly notify: NotificationsService,
    private readonly stream: NotificationsStreamService,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(Submission)
    private readonly submissionsRepo: Repository<Submission>,
    private readonly concepts: ConceptsService,
    private readonly payouts: PayoutsService,
    private readonly leaderboard: LeaderboardService,
    private readonly uploads: UploadsService,
  ) {}

  // -----------------------------------------------------------------
  // Dashboard
  // -----------------------------------------------------------------
  @Get(['dashboard', 'dashboard/overview'])
  @ApiOperation({ summary: 'Contributor dashboard summary & overview' })
  async getDashboard(@Req() req: Request) {
    const user = req.user as { sub: string };
    const walletSummary = await this.wallet.summary(user.sub);

    const submissions = await this.submissionsRepo.find({
      where: { userId: user.sub },
      order: { updatedAt: 'DESC' },
    });

    const draftsCount = submissions.filter((s) => s.status === 'draft').length;
    const underReviewCount = submissions.filter(
      (s) => s.status === 'pending_review',
    ).length;
    const revisionRequestedCount = submissions.filter(
      (s) => s.status === 'changes_requested',
    ).length;
    const approvedCount = submissions.filter(
      (s) => s.status === 'approved',
    ).length;
    const rejectedCount = submissions.filter(
      (s) => s.status === 'rejected',
    ).length;
    const totalDecided = approvedCount + rejectedCount;
    const approvalRate =
      totalDecided > 0 ? Math.round((approvedCount / totalDecided) * 100) : 100;

    const inProgress = submissions
      .filter((s) => s.status === 'draft' || s.status === 'changes_requested')
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        title: s.title,
        detail:
          s.status === 'changes_requested'
            ? 'Revision requested · Reviewer note available'
            : 'Draft · In progress',
        icon: s.status === 'changes_requested' ? '⌁' : '◌',
        iconTone: s.status === 'changes_requested' ? 'lavender' : 'mint',
        action: s.status === 'changes_requested' ? 'review' : 'continue',
        progress: s.status === 'changes_requested' ? undefined : 60,
      }));

    const recentNotifications = await this.notifications.find({
      where: { recipientId: user.sub },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    const activity = recentNotifications.map((n) => ({
      id: n.id,
      title: n.title,
      detail:
        n.body ??
        (n.type === 'submission_decision' ? 'Decision update' : 'Notification'),
      icon:
        n.type === 'submission_decision'
          ? '✓'
          : n.type === 'payout_decision'
            ? '৳'
            : '✦',
    }));

    const stats = [
      {
        id: 'stat_balance',
        label: 'Available balance',
        value: `Tk ${Number(walletSummary.balance).toLocaleString()}`,
        description:
          Number(walletSummary.pending) > 0
            ? `Tk ${walletSummary.pending} in-flight payout`
            : undefined,
        tone: 'default' as const,
        valueSize: 'lg' as const,
      },
      {
        id: 'stat_approved',
        label: 'Approved ideas',
        value: String(approvedCount),
        description:
          underReviewCount > 0
            ? `${underReviewCount} currently under review`
            : 'Lifetime approvals',
        tone: 'positive' as const,
      },
      {
        id: 'stat_lifetime',
        label: 'Lifetime earnings',
        value: `Tk ${Number(walletSummary.lifetime_credits).toLocaleString()}`,
        description: 'Total rewards earned',
      },
      {
        id: 'stat_rate',
        label: 'Approval rate',
        value: `${approvalRate}%`,
        description:
          totalDecided > 0
            ? `${approvedCount} of ${totalDecided} decided`
            : 'No decisions yet',
        tone: 'positive' as const,
      },
    ];

    return {
      eyebrow: 'Contributor space',
      description: 'You have drafts to shape and live opportunities waiting.',
      stats,
      inProgress,
      activity,
      wallet: {
        available_balance: Number(walletSummary.balance),
        pending_balance: Number(walletSummary.pending),
        lifetime_earnings: Number(walletSummary.lifetime_credits),
      },
      gamification: {
        rank: 1,
        points: Math.round(Number(walletSummary.lifetime_credits)),
        streak: 1,
        approvals_count: approvedCount,
      },
      submissions_summary: {
        drafts_count: draftsCount,
        under_review_count: underReviewCount,
        revision_requested_count: revisionRequestedCount,
        approved_count: approvedCount,
      },
      recent_activity: activity,
    };
  }

  // -----------------------------------------------------------------
  // Leaderboard
  // -----------------------------------------------------------------
  @Get('leaderboard')
  @ApiOperation({ summary: 'Contributor view leaderboard' })
  async getLeaderboard(@Query() query: ContributorLeaderboardQueryDto) {
    const rows = await this.leaderboard.list({
      period: query.period,
      limit: query.limit ?? 25,
    });
    return { period: query.period, data: rows };
  }

  // -----------------------------------------------------------------
  // Concepts (assigned = published)
  // -----------------------------------------------------------------
  @Get('concepts')
  @ApiOperation({
    summary: 'List published concepts available to contributors',
  })
  async listConcepts(@Query() query: ContributorConceptsListQueryDto) {
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.concepts.findPublished({
      category_id: query.category_id,
      page,
      limit,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  @Get('concepts/:id')
  @ApiOperation({ summary: 'Get a published concept by id' })
  async getConcept(@Param() params: SubmissionIdParamDto) {
    const found = await this.concepts.findOne(params.id);
    if (found.status !== 'active' && (found.status as string) !== 'published') {
      throw ApiException.notFound('Concept');
    }
    return found;
  }

  // -----------------------------------------------------------------
  // Submissions
  // -----------------------------------------------------------------
  @Post('submissions')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Create a new submission (draft)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  async createSubmission(
    @Body() input: CreateSubmissionDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    const user = req.user as { sub: string };
    let attachments = input.attachments ?? null;
    if (file) {
      const stored = await this.uploads.storeAttachment({
        originalname: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
      });
      attachments = {
        url: stored.url,
        mime_type: stored.mime_type,
        size: stored.size,
        original_name: stored.original_name,
      };
    }
    return this.submissions.create(user.sub, {
      ...input,
      attachments: attachments ?? undefined,
    });
  }

  @Get('submissions')
  @ApiOperation({ summary: 'List my submissions' })
  async listMySubmissions(
    @Query() query: SubmissionListQueryDto,
    @Req() req: Request,
  ) {
    const user = req.user as { sub: string };
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.submissions.list({
      userId: user.sub,
      status: query.status,
      concept_id: query.concept_id,
      search: query.search,
      page,
      limit,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  @Get('submissions/:id')
  @ApiOperation({ summary: 'Get one of my submissions' })
  async getSubmission(
    @Param() params: SubmissionIdParamDto,
    @Req() req: Request,
  ) {
    const user = req.user as { sub: string };
    return this.submissions.findOneForUser(params.id, user.sub);
  }

  @Patch('submissions/:id')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Edit a draft / changes-requested submission' })
  @ApiConsumes('multipart/form-data', 'application/json')
  async updateSubmission(
    @Param() params: SubmissionIdParamDto,
    @Body() body: UpdateSubmissionDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    const user = req.user as { sub: string };
    let attachments = body.attachments;
    if (file) {
      const stored = await this.uploads.storeAttachment({
        originalname: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
      });
      attachments = {
        url: stored.url,
        mime_type: stored.mime_type,
        size: stored.size,
        original_name: stored.original_name,
      };
    }
    return this.submissions.update(params.id, user.sub, {
      ...body,
      attachments,
    });
  }

  @Post('submissions/:id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a draft for admin review' })
  async submitForReview(
    @Param() params: SubmissionIdParamDto,
    @Req() req: Request,
  ) {
    const user = req.user as { sub: string };
    return this.submissions.submit(params.id, user.sub);
  }

  @Delete('submissions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a submission (draft only)' })
  async removeSubmission(
    @Param() params: SubmissionIdParamDto,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as { sub: string };
    await this.submissions.softDelete(params.id, user.sub);
  }

  @Get('wallet')
  @ApiOperation({ summary: 'My wallet summary & ledger entries' })
  async myWallet(@Query() query: LedgerListQueryDto, @Req() req: Request) {
    const user = req.user as { sub: string };
    const summary = await this.wallet.summary(user.sub);
    const { data: ledgerEntries, total } = await this.wallet.listForUser({
      userId: user.sub,
      query,
    });

    const typeMap: Record<string, string> = {
      reward_credit: 'Reward',
      payout_hold: 'Withdrawal',
      payout_reversal: 'Adjustment',
      manual_adjustment: 'Adjustment',
    };

    const resolveStatus = (type: string, status: string): string => {
      if (type === 'payout_hold') {
        if (status === 'pending') return 'Pending';
        if (status === 'posted') return 'Paid';
        if (status === 'reversed') return 'Rejected';
      }
      if (status === 'reversed') return 'Rejected';
      if (status === 'pending') return 'Pending';
      if (status === 'posted') {
        return type === 'reward_credit' ? 'Available' : 'Recorded';
      }
      return 'Recorded';
    };

    const entries = ledgerEntries.map((l) => ({
      id: l.id,
      description:
        (l.metadata?.description as string) ??
        (l.type === 'reward_credit'
          ? 'Reward earned'
          : l.type === 'payout_hold'
            ? 'Withdrawal request'
            : 'Adjustment'),
      date: (l.postedAt
        ? l.postedAt.toISOString()
        : l.createdAt.toISOString()
      ).slice(0, 10),
      type: typeMap[l.type] ?? 'Reward',
      amount: `Tk ${Math.abs(Number(l.amount)).toLocaleString()}`,
      status: resolveStatus(l.type, l.status),
    }));

    return {
      available: `Tk ${Number(summary.balance).toLocaleString()}`,
      pending: `Tk ${Number(summary.pending).toLocaleString()}`,
      paidToDate: `Tk ${Number(summary.lifetime_debits).toLocaleString()}`,
      payoutMethod: 'bKash',
      entries,
      balance: summary.balance,
      lifetime_credits: summary.lifetime_credits,
      lifetime_debits: summary.lifetime_debits,
      balances: {
        available_balance: Number(summary.balance),
        pending_balance: Number(summary.pending),
        lifetime_earnings: Number(summary.lifetime_credits),
      },
      ledger_entries: ledgerEntries,
      meta: buildPaginationMeta(query.page ?? 1, query.limit ?? 20, total),
    };
  }

  @Get('wallet/transactions')
  @ApiOperation({ summary: 'My ledger entries (paginated)' })
  async myTransactions(
    @Query() query: LedgerListQueryDto,
    @Req() req: Request,
  ) {
    const user = req.user as { sub: string };
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.wallet.listForUser({
      userId: user.sub,
      query,
    });
    return {
      data: data.map((l) => ({
        id: l.id,
        user_id: l.userId,
        type: l.type,
        amount: l.amount,
        status: l.status,
        reference: l.reference,
        metadata: l.metadata,
        posted_at: l.postedAt,
        created_at: l.createdAt,
      })),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  // -----------------------------------------------------------------
  // Notifications
  // -----------------------------------------------------------------
  @Get('notifications/stream')
  @Sse()
  @ApiOperation({
    summary: 'Subscribe to my notification events (Server-Sent Events)',
  })
  streamNotifications(@Req() req: Request): Observable<MessageEvent> {
    const user = req.user as { sub: string };
    const data$ = this.stream.subscribe(user.sub);
    // 15s heartbeat keeps proxies from dropping idle connections.
    const heartbeat$ = interval(15_000).pipe(
      map(
        () =>
          ({
            type: 'ping',
            data: '',
          }) satisfies MessageEvent,
      ),
    );
    return merge(data$, heartbeat$);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'My notifications' })
  async myNotifications(
    @Query() query: NotificationsListQueryDto,
    @Req() req: Request,
  ) {
    const user = req.user as { sub: string };
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.notify.listForRecipient({
      recipientId: user.sub,
      read_state: query.read_state,
      page,
      limit,
    });
    return {
      data: data.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        payload: n.payload,
        linked_record_type: n.linkedRecordType,
        linked_record_id: n.linkedRecordId,
        read_state: n.readState,
        read_at: n.readAt?.toISOString?.() ?? n.readAt ?? null,
        created_at:
          n.createdAt instanceof Date
            ? n.createdAt.toISOString()
            : new Date(n.createdAt).toISOString(),
      })),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  @Patch('notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markNotificationRead(
    @Param() params: NotificationIdParamDto,
    @Req() req: Request,
  ) {
    const user = req.user as { sub: string };
    const updated = await this.notify.markRead({
      id: params.id,
      recipientId: user.sub,
    });
    return {
      id: updated.id,
      read_state: updated.readState,
      read_at: updated.readAt,
    };
  }

  @Post('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  async markAllRead(@Req() req: Request) {
    const user = req.user as { sub: string };
    return this.notify.markAllRead(user.sub);
  }

  // -----------------------------------------------------------------
  // Payouts
  // -----------------------------------------------------------------
  @Post('payouts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Request a payout (atomic hold on wallet balance)',
  })
  async requestPayout(@Body() body: CreatePayoutDto, @Req() req: Request) {
    const user = req.user as { sub: string };
    return this.payouts.request({ userId: user.sub, body });
  }

  @Get('payouts')
  @ApiOperation({ summary: 'My payout requests' })
  async myPayouts(
    @Query() query: ContributorPayoutListQueryDto,
    @Req() req: Request,
  ) {
    const user = req.user as { sub: string };
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.payouts.listMine({
      userId: user.sub,
      page,
      limit,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }
}
