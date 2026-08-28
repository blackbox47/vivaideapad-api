import {
  Body,
  Controller,
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
import { PayoutsService } from './payouts.service';
import {
  CreatePayoutDto,
  PayoutIdParamDto,
  PayoutListQueryDto,
  ProcessPayoutDto,
} from './dto/payouts.dto';
import { USER_ROLES } from '../../users/entities/user.entity';

@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller('admin/payouts')
export class AdminPayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get()
  @ApiOperation({ summary: 'List payouts' })
  async list(@Query() query: PayoutListQueryDto) {
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.payouts.list({
      status: query.status,
      user_id: query.user_id,
      date_from: query.date_from,
      date_to: query.date_to,
      page,
      limit,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payout detail' })
  async get(@Param() params: PayoutIdParamDto) {
    return this.payouts.findOne(params.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a payout on behalf of a contributor (admin)',
  })
  async create(
    @Body() body: CreatePayoutDto & { user_id: string },
    @Req() req: Request,
  ) {
    const actor = req.user as { sub: string };
    return this.payouts.adminCreate({
      actorId: actor.sub,
      userId: body.user_id,
      body,
    });
  }

  @Post(':id/process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'mark_paid or reject a payout (transactional)' })
  async process(
    @Param() params: PayoutIdParamDto,
    @Body() body: ProcessPayoutDto,
    @Req() req: Request,
  ) {
    const actor = req.user as { sub: string };
    return this.payouts.process({ id: params.id, actorId: actor.sub, body });
  }
}
