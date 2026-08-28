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
  UseGuards,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  buildPaginationMeta,
  parsePagination,
} from '../../common/utils/pagination';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { ApplicationsService } from './applications.service';
import {
  ApplicationDecisionDto,
  ApplicationIdParamDto,
  ApplicationListQueryDto,
} from './dto/applications.dto';
import { USER_ROLES } from '../../users/entities/user.entity';

@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller('admin/applications')
export class AdminApplicationsController {
  constructor(private readonly apps: ApplicationsService) {}

  @Get()
  @ApiOperation({ summary: 'List applications' })
  async list(@Query() query: ApplicationListQueryDto) {
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.apps.list({
      status: query.status,
      user_id: query.user_id,
      category_id: query.category_id,
      page,
      limit,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application detail' })
  @ApiOkResponse({ description: 'The application' })
  async get(@Param() params: ApplicationIdParamDto) {
    return this.apps.findOne(params.id);
  }

  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decide an application (transactional)' })
  async decide(
    @Param() params: ApplicationIdParamDto,
    @Body() body: ApplicationDecisionDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.apps.decide({
      id: params.id,
      actorId: actor.id,
      body,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an application' })
  @ApiNoContentResponse({ description: 'Application deleted' })
  async remove(@Param() params: ApplicationIdParamDto): Promise<void> {
    await this.apps.softDelete(params.id);
  }
}
