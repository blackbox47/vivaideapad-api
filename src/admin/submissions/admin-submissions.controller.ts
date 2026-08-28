import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  buildPaginationMeta,
  parsePagination,
} from '../../common/utils/pagination';
import { AdminSubmissionsService } from './admin-submissions.service';
import {
  AdminSubmissionDecisionDto,
  AdminSubmissionIdParamDto,
  AdminSubmissionListQueryDto,
} from './dto/admin-submissions.dto';
import { USER_ROLES } from '../../users/entities/user.entity';

@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller('admin/submissions')
export class AdminSubmissionsController {
  constructor(private readonly submissions: AdminSubmissionsService) {}

  @Get()
  @ApiOperation({ summary: 'List submissions' })
  async list(@Query() query: AdminSubmissionListQueryDto) {
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.submissions.list({
      status: query.status,
      user_id: query.user_id,
      concept_id: query.concept_id,
      page,
      limit,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get submission detail' })
  async get(@Param() params: AdminSubmissionIdParamDto) {
    return this.submissions.findOne(params.id);
  }

  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Decide a submission (atomic — flip status, ledger row, leaderboard upsert, audit, notify)',
  })
  async decide(
    @Param() params: AdminSubmissionIdParamDto,
    @Body() body: AdminSubmissionDecisionDto,
    @Req() req: Request,
  ) {
    const actor = req.user as { sub: string };
    return this.submissions.decide({
      id: params.id,
      actorId: actor.sub,
      body,
    });
  }

  @Post(':id/risk-scan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Run an AI risk scan (stub: always returns {score:0, flags:[], summary:"clean"})',
  })
  async riskScan(
    @Param() params: AdminSubmissionIdParamDto,
    @Req() req: Request,
  ) {
    const actor = req.user as { sub: string };
    return this.submissions.riskScan({ id: params.id, actorId: actor.sub });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a submission' })
  async remove(@Param() params: AdminSubmissionIdParamDto): Promise<void> {
    await this.submissions.softDelete(params.id);
  }
}
