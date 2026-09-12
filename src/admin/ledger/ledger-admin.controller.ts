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
import { LedgerAdminService } from './ledger-admin.service';
import {
  AdminLedgerListQueryDto,
  LedgerIdParamDto,
  ManualAdjustmentDto,
} from './dto/ledger-admin.dto';
import { USER_ROLES } from '../../users/entities/user.entity';

@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller(['admin/ledger', 'admin/rewards-ledger'])
export class AdminLedgerController {
  constructor(private readonly ledger: LedgerAdminService) {}

  @Get()
  @ApiOperation({ summary: 'Search ledger entries' })
  async list(@Query() query: AdminLedgerListQueryDto) {
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.ledger.list({
      user_id: query.user_id,
      type: query.type,
      status: query.status,
      date_from: query.date_from,
      date_to: query.date_to,
      search: query.search,
      page,
      limit,
    });
    return {
      data,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ledger entry detail' })
  async get(@Param() params: LedgerIdParamDto) {
    return this.ledger.findOne(params.id);
  }

  @Post('manual-adjustment')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Insert a manual ledger adjustment (transactional with audit)',
  })
  async manualAdjustment(
    @Body() body: ManualAdjustmentDto,
    @Req() req: Request,
  ) {
    const actor = req.user as { sub: string };
    return this.ledger.manualAdjustment({
      actorId: actor.sub,
      body,
    });
  }
}
