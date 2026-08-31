import {
  Body,
  Controller,
  Delete,
  Get,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable, interval, merge } from 'rxjs';
import { map } from 'rxjs/operators';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  buildPaginationMeta,
  parsePagination,
} from '../../common/utils/pagination';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { ApiException } from '../../common/exceptions/api-exception';
import { AdminNotificationsService } from './admin-notifications.service';
import { NotificationsStreamService } from './notifications-stream.service';
import { USER_ROLES, isUserRole } from '../../users/entities/user.entity';

const ListQuerySchema = z.object({
  recipient_id: z.string().uuid().optional(),
  read_state: z.enum(['unread', 'read']).optional(),
  filter: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});
class ListQueryDto extends createZodDto(ListQuerySchema) {}

const IdParamSchema = z.object({ id: z.string().uuid() });
class IdParamDto extends createZodDto(IdParamSchema) {}

const BroadcastSchema = z.object({
  recipient_ids: z.array(z.string().uuid()).optional(),
  role_target: z.coerce
    .number()
    .int()
    .refine(isUserRole, 'invalid role_target')
    .optional(),
  type: z.enum([
    'application_decision',
    'submission_decision',
    'payout_status_changed',
    'access_status_changed',
    'broadcast',
    'system',
  ]),
  title: z.string().min(1).max(255),
  body: z.string().max(2000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  linked_record_type: z.string().max(80).optional(),
  linked_record_id: z.string().max(36).optional(),
});
class BroadcastDto extends createZodDto(BroadcastSchema) {}

@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(
    private readonly notifications: AdminNotificationsService,
    private readonly stream: NotificationsStreamService,
  ) {}

  @Get('notifications/stream')
  @Sse()
  @ApiOperation({
    summary: 'Subscribe to admin notification events (Server-Sent Events)',
  })
  streamAdmin(@CurrentUser() actor: { id: string }): Observable<MessageEvent> {
    const data$ = this.stream.subscribe(actor.id);
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

  @Get()
  @ApiOperation({ summary: 'SPA-orphan admin notifications inbox' })
  @ApiOkResponse({ description: 'Paginated notifications' })
  async list(
    @Query() query: ListQueryDto,
    @CurrentUser() actor: { id: string },
  ) {
    const { page, limit } = parsePagination(query);
    const recipientId = query.recipient_id ?? actor?.id;
    if (!recipientId) {
      throw ApiException.validation('recipient_id is required');
    }

    let readState = query.read_state;
    if (!readState && query.filter) {
      const f = query.filter.toLowerCase();
      if (f === 'unread') readState = 'unread';
      else if (f === 'read') readState = 'read';
    }

    const result = await this.notifications.listForRecipient({
      recipientId,
      read_state: readState,
      page,
      limit,
    });
    return {
      data: result.data,
      meta: buildPaginationMeta(page, limit, result.meta.total),
    };
  }

  @Post('broadcast')
  @ApiOperation({ summary: 'Broadcast a notification (by ids or role target)' })
  async broadcast(
    @Body() body: BroadcastDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.notifications.broadcast({
      actorId: actor.id,
      body,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a notification' })
  async delete(
    @Param() params: IdParamDto,
    @CurrentUser() actor: { id: string },
  ) {
    await this.notifications.softDelete(params.id, actor.id);
    return { deleted: true };
  }
}
