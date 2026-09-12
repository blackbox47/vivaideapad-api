import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { Public } from '../common/decorators/roles.decorator';
import { LeaderboardService } from '../admin/leaderboard/leaderboard.service';

const PublicLeaderboardQuerySchema = z.object({
  period: z.enum(['all_time', 'monthly', 'weekly']).default('all_time'),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export class PublicLeaderboardQueryDto extends createZodDto(
  PublicLeaderboardQuerySchema,
) {}

@ApiTags('Public')
@Controller('public/leaderboard')
export class PublicLeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Public top-N leaderboard' })
  @ApiOkResponse({ description: 'Public top leaderboard entries' })
  async getLeaderboard(@Query() query: PublicLeaderboardQueryDto) {
    const period = query.period ?? 'all_time';
    const data = await this.leaderboard.findPublicTop(
      query.limit ?? 5,
      period,
    );
    return { period, data };
  }
}
