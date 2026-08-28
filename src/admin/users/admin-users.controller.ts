import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  buildPaginationMeta,
  parsePagination,
} from '../../common/utils/pagination';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { AdminUsersService } from './admin-users.service';
import {
  AdminUserIdParamDto,
  AdminUserListQueryDto,
  UpdateAccessStatusDto,
  UpdateRoleDto,
} from './dto/admin-users.dto';
import { USER_ROLES } from '../../users/entities/user.entity';

interface UpdateProfileBody {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
}

// Schema is referenced for documentation/swagger generation only —
// body is parsed by class-level ZodValidationPipe using createZodDto.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const UpdateProfileSchema = z
  .object({
    display_name: z.string().min(1).max(120).optional(),
    bio: z.string().max(2000).optional(),
    avatar_url: z.string().url().optional(),
  })
  .strict();

@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users (admin)' })
  @ApiOkResponse({ description: 'Paginated users' })
  async list(@Query() query: AdminUserListQueryDto) {
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.users.list(query, page, limit);
    return {
      data,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'User detail (admin)' })
  async get(@Param() params: AdminUserIdParamDto) {
    return this.users.findOne(params.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile (admin)' })
  async update(
    @Param() params: AdminUserIdParamDto,
    @Body() body: UpdateProfileBody,
    @CurrentUser() actor: { id: string },
  ) {
    return this.users.updateProfile({
      id: params.id,
      actorId: actor.id,
      body,
    });
  }

  @Patch(':id/access-status')
  @ApiOperation({ summary: 'Update user access_status (admin)' })
  async updateAccess(
    @Param() params: AdminUserIdParamDto,
    @Body() body: UpdateAccessStatusDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.users.updateAccessStatus({
      id: params.id,
      actorId: actor.id,
      body,
    });
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Update user role (admin)' })
  async updateRole(
    @Param() params: AdminUserIdParamDto,
    @Body() body: UpdateRoleDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.users.updateRole({
      id: params.id,
      actorId: actor.id,
      body,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a user (admin)' })
  async delete(
    @Param() params: AdminUserIdParamDto,
    @CurrentUser() actor: { id: string },
  ) {
    await this.users.softDelete({ id: params.id, actorId: actor.id });
    return { deleted: true };
  }
}
