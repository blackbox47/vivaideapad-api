import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../common/decorators/roles.decorator';
import { AuthService } from './auth.service';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { PasswordChangeDto } from './dto/password-change.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { JwtAccessGuard } from './guards/jwt-access.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('sign-up')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new account (no JWT returned)' })
  @ApiCreatedResponse({
    description: 'Account created',
    schema: { type: 'object', properties: { id: { type: 'string' } } },
  })
  async signUp(@Body() input: SignUpDto) {
    const user = await this.auth.signUp(input);
    return { id: user.id };
  }

  @Public()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in and obtain access + refresh tokens' })
  @ApiOkResponse({ description: 'Tokens + user profile' })
  async signIn(@Body() input: SignInDto, @Req() req: Request) {
    const ua = req.headers['user-agent'] ?? '';
    return this.auth.signIn({ ...input, ua });
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token' })
  @ApiOkResponse({ description: 'New token pair' })
  async refresh(@Body() _body: RefreshDto, @Req() req: Request) {
    const user = req.user as { sub: string; jti: string };
    const ua = req.headers['user-agent'] ?? '';
    return this.auth.refresh({ sub: user.sub, jti: user.jti, ua });
  }

  @UseGuards(JwtAccessGuard)
  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the active refresh token' })
  async signOut(@Req() req: Request): Promise<void> {
    const user = req.user as { sub: string; jti?: string };
    if (!user.jti) return;
    await this.auth.signOut({ sub: user.sub, jti: user.jti });
  }

  @UseGuards(JwtAccessGuard)
  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change the current user password' })
  async changePassword(
    @Body() body: PasswordChangeDto,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as { sub: string };
    await this.auth.changePassword({
      userId: user.sub,
      currentPassword: body.current_password,
      newPassword: body.new_password,
    });
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a password reset (always 202)' })
  async forgotPassword(@Body() body: { email: string }): Promise<void> {
    await this.auth.forgotPassword(body.email);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Consume a password reset token' })
  async resetPassword(
    @Body() body: { token: string; new_password: string },
  ): Promise<void> {
    await this.auth.resetPassword(body.token, body.new_password);
  }
}
