import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { USER_ROLES } from '../../users/entities/user.entity';
import {
  ReviewQueueService,
  ReviewQueueResponse,
} from './review-queue.service';
import { ReviewQueueDecideDto } from './dto/review-queue-decide.dto';

/**
 * Legacy aggregate endpoints backing the content-review page in the SPA.
 *
 * The spec-aligned equivalents live under /admin/submissions (see
 * `src/admin/submissions/admin-submissions.controller.ts`). Both paths share
 * the same decide transaction via `AdminSubmissionsService.decide()` so the
 * ledger / leaderboard / audit / notify side-effects stay consistent.
 *
 * Authorization: ADMINISTRATOR (level 2). SUPERADMIN (level 3) is admitted by
 * `RolesGuard` via the `USER_ROLE_LEVEL` hierarchy — see
 * `src/common/guards/roles.guard.ts:41-47`.
 */
@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller('admin/review-queue')
export class ReviewQueueController {
  constructor(private readonly queue: ReviewQueueService) {}

  @Get()
  @ApiOperation({
    summary:
      'Review queue snapshot — all submissions with contributor + AI risk + per-contributor approval metrics',
  })
  @ApiOkResponse({ description: 'Aggregated content-review submissions' })
  async list(): Promise<ReviewQueueResponse> {
    return this.queue.queue();
  }

  @Patch()
  @ApiOperation({
    summary:
      'Legacy decide endpoint — flips submission status, routes through the atomic spec-aligned decide pipeline (ledger + leaderboard + audit + notify)',
  })
  @ApiOkResponse({ description: 'Refreshed review queue snapshot' })
  async decide(
    @Body() body: ReviewQueueDecideDto,
    @Req() req: Request,
  ): Promise<ReviewQueueResponse> {
    const actor = req.user as { sub: string };
    return this.queue.decide(actor.sub, {
      id: body.id,
      status: body.status,
      comment: body.comment,
      reward_amount: body.reward_amount,
      revision_window_days: body.revision_window_days,
    });
  }
}
