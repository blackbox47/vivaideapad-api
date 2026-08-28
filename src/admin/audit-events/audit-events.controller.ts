import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  buildPaginationMeta,
  parsePagination,
} from '../../common/utils/pagination';
import { AuditEventsService } from './audit-events.service';
import {
  AuditEventIdParamDto,
  AuditEventListQueryDto,
} from './dto/audit-events.dto';
import { USER_ROLES } from '../../users/entities/user.entity';

@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller('admin/audit-events')
export class AdminAuditEventsController {
  constructor(private readonly audit: AuditEventsService) {}

  @Get()
  @ApiOperation({
    summary: 'List audit events (filter by actor/target/action/date)',
  })
  @ApiOkResponse({ description: 'Paginated audit events' })
  async list(@Query() query: AuditEventListQueryDto) {
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.audit.list({
      actor_id: query.actor_id,
      target_type: query.target_type,
      target_id: query.target_id,
      action: query.action,
      category: query.category,
      search: query.search,
      date_from: query.date_from,
      date_to: query.date_to,
      page,
      limit,
    });
    return {
      data,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Audit event detail' })
  async get(@Param() params: AuditEventIdParamDto) {
    return this.audit.findOne(params.id);
  }
}
