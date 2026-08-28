import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { DashboardService } from './dashboard.service';
import { USER_ROLES } from '../../users/entities/user.entity';

const StatsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(180).optional(),
});
class StatsQueryDto extends createZodDto(StatsQuerySchema) {}

@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'SPA-orphan dashboard overview (counts + sums)' })
  @ApiOkResponse({ description: 'Aggregated metrics' })
  async overview() {
    return this.dashboard.overview();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard time-series stats' })
  async stats(@Query() query: StatsQueryDto) {
    return this.dashboard.stats({ days: query.days });
  }
}
