import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { ProfileService } from './profile.service';
import { USER_ROLES } from '../../users/entities/user.entity';

const UpdateProfileSchema = z.object({
  display_name: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(120).optional(),
  bio: z.string().max(2000).optional(),
  phone: z.string().max(40).optional(),
  avatar_url: z.string().max(512).optional(),
});
class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}

const UpdateNotificationsSchema = z.object({
  email: z.boolean().optional(),
  in_app: z.boolean().optional(),
  inApp: z.boolean().optional(),
});
class UpdateNotificationsDto extends createZodDto(UpdateNotificationsSchema) {}

const UpdatePayoutMethodSchema = z.object({
  method: z.string().min(1).max(40).optional(),
  label: z.string().min(1).max(120).optional(),
  account: z.string().max(80).optional(),
  mobile: z.string().max(80).optional(),
  phone: z.string().max(80).optional(),
});
class UpdatePayoutMethodDto extends createZodDto(UpdatePayoutMethodSchema) {}

const UpdateAvatarSchema = z.object({
  dataUrl: z.string().min(1).optional(),
  avatar_url: z.string().max(512).optional(),
});
class UpdateAvatarDto extends createZodDto(UpdateAvatarSchema) {}

const DisplayPrefsSchema = z.object({
  prefs: z.record(z.string(), z.unknown()),
});
class UpdateDisplayPrefsDto extends createZodDto(DisplayPrefsSchema) {}

const UpdatePasswordSchema = z.object({
  password: z.string().min(8).max(128).optional(),
  new_password: z.string().min(8).max(128).optional(),
  current_password: z.string().min(1).max(128).optional(),
  currentPassword: z.string().min(1).max(128).optional(),
});
class UpdatePasswordDto extends createZodDto(UpdatePasswordSchema) {}

@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.CONTRIBUTOR)
@Controller([
  'admin/profile',
  'creator/profile',
  'contributor/profile',
  'contributor/me',
  'creator/me',
])
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ description: 'Self profile' })
  async get(@CurrentUser() actor: { id: string }) {
    return this.profile.getSelf(actor.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update current user profile' })
  async update(
    @Body() body: UpdateProfileDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.profile.updateSelf({ userId: actor.id, body });
  }

  @Post('password')
  @ApiOperation({ summary: 'Update current user password' })
  async updatePassword(
    @Body() body: UpdatePasswordDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.profile.updatePassword({ userId: actor.id, body });
  }

  @Patch('password')
  @ApiOperation({ summary: 'Update current user password (patch)' })
  async updatePasswordPatch(
    @Body() body: UpdatePasswordDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.profile.updatePassword({ userId: actor.id, body });
  }

  @Get('display')
  @ApiOperation({ summary: 'Get current user display prefs (SPA-orphan)' })
  async getDisplay(@CurrentUser() actor: { id: string }) {
    return this.profile.getDisplayPrefs(actor.id);
  }

  @Patch('display')
  @ApiOperation({ summary: 'Update current user display prefs' })
  async updateDisplay(
    @Body() body: UpdateDisplayPrefsDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.profile.updateDisplayPrefs({
      userId: actor.id,
      prefs: body.prefs,
    });
  }

  @Patch('notifications')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updateNotifications(
    @Body() body: UpdateNotificationsDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.profile.updateNotifications({
      userId: actor.id,
      email: body.email,
      inApp: body.in_app ?? body.inApp,
    });
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Update profile avatar' })
  async updateAvatar(
    @Body() body: UpdateAvatarDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.profile.updateAvatar({
      userId: actor.id,
      dataUrl: body.dataUrl,
      avatarUrl: body.avatar_url,
    });
  }

  @Patch('payout-method')
  @ApiOperation({ summary: 'Update payout method' })
  async updatePayoutMethod(
    @Body() body: UpdatePayoutMethodDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.profile.updatePayoutMethod({
      userId: actor.id,
      method: body.method,
      label: body.label,
      account: body.account ?? body.mobile ?? body.phone,
    });
  }
}
