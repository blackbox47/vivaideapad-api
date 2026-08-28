import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  buildPaginationMeta,
  parsePagination,
} from '../../common/utils/pagination';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { AdminsService } from './admins.service';
import {
  AdminIdParamDto,
  AdminListQueryDto,
  CreateAdminDto,
  UpdateAdminDto,
} from './dto/admins.dto';
import { USER_ROLES } from '../../users/entities/user.entity';

@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller('admin/admins')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  @ApiOperation({ summary: 'SPA-orphan list administrators' })
  @ApiOkResponse({ description: 'Paginated administrators' })
  async list(@Query() query: AdminListQueryDto) {
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.admins.list({
      search: query.search,
      page,
      limit,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  @Post()
  @Roles(USER_ROLES.SUPERADMIN)
  @ApiOperation({ summary: 'Create a new administrator' })
  async create(
    @Body() body: CreateAdminDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.admins.create({ actorId: actor.id, body });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Administrator detail' })
  async get(@Param() params: AdminIdParamDto) {
    return this.admins.findOne(params.id);
  }

  @Patch(':id')
  @Roles(USER_ROLES.SUPERADMIN)
  @ApiOperation({ summary: 'Update administrator' })
  async update(
    @Param() params: AdminIdParamDto,
    @Body() body: UpdateAdminDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.admins.update({ id: params.id, actorId: actor.id, body });
  }

  @Delete(':id')
  @Roles(USER_ROLES.SUPERADMIN)
  @ApiOperation({ summary: 'Soft delete administrator' })
  async delete(
    @Param() params: AdminIdParamDto,
    @CurrentUser() actor: { id: string },
  ) {
    await this.admins.softDelete({ id: params.id, actorId: actor.id });
    return { deleted: true };
  }
}
