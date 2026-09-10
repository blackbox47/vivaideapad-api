import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { LeaderboardService } from './leaderboard.service';
import { USER_ROLES } from '../../users/entities/user.entity';

const ListQuerySchema = z.object({
  period: z.enum(['all_time', 'monthly', 'weekly']).default('all_time'),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().optional(),
});
class ListQueryDto extends createZodDto(ListQuerySchema) {}

@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller('admin/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: 'SPA-orphan top-N leaderboard rows' })
  @ApiOkResponse({ description: 'Leaderboard rows' })
  async list(@Query() query: ListQueryDto) {
    const rows = await this.leaderboard.list({
      period: query.period,
      limit: query.limit ?? 25,
      search: query.search,
    });
    return { period: query.period, data: rows };
  }

  @Post('recalculate')
  @ApiOperation({ summary: 'SPA-orphan recompute all_time leaderboard' })
  async recalculate() {
    return this.leaderboard.recalculateAllTime();
  }
}
