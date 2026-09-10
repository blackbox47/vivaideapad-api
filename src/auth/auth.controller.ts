import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { Public } from '../common/decorators/roles.decorator';
import { AuthService } from './auth.service';
import { clearAuthCookies, setAuthCookies } from './cookie-options';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { TokensDto } from './dto/tokens.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { GoogleSignInDto } from './google/dto/google-sign-in.dto';
import { GoogleAuthService } from './google/google-auth.service';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { PasswordChangeDto } from './dto/password-change.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly googleAuth: GoogleAuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('sign-up')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Public contributor sign-up (no JWT returned)',
    description:
      'Creates an account with accessStatus=pending_review and emails a ' +
      'verification link. The user cannot sign in until an admin approves ' +
      'them via POST /admin/applications/:id/decision.',
  })
  @ApiCreatedResponse({
    description: 'Verification email queued.',
    schema: {
      type: 'object',
      properties: { email: { type: 'string' } },
    },
  })
  async signUp(@Body() input: SignUpDto) {
    const result = await this.auth.signUp(input);
    return { email: result.email };
  }

  @Public()
  @ApiOperation({ summary: 'Sign in and obtain access + refresh tokens' })
  @ApiOkResponse({
    description: 'Tokens are set as HttpOnly cookies; body returns the user.',
    type: TokensDto,
  })
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body() input: SignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ua = req.headers['user-agent'] ?? '';
    const tokens = await this.auth.signIn({ ...input, ua });
    setAuthCookies(res, this.config, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user: { id: tokens.user.id, role: tokens.user.role },
    });
    // Tokens live in cookies only; the body carries the user view so the SPA
    // can hydrate Redux without a second request.
    return { user: tokens.user };
  }

  @Public()
  @ApiOperation({
    summary: 'Google Sign-In for creators (credential exchange)',
  })
  @ApiOkResponse({
    description: 'Tokens are set as HttpOnly cookies; body returns the user.',
    type: TokensDto,
  })
  @Post('google/sign-in')
  @HttpCode(HttpStatus.OK)
  async googleSignIn(
    @Body() input: GoogleSignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ua = req.headers['user-agent'] ?? '';
    const tokens = await this.googleAuth.signIn({ ...input, ua });
    setAuthCookies(res, this.config, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user: { id: tokens.user.id, role: tokens.user.role },
    });
    return { user: tokens.user };
  }

  @Public()
  @Post('google/sign-up')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Public contributor sign-up via Google (no JWT returned)',
    description:
      'Verifies the Google ID token, creates a pending_review user if ' +
      'new, or rejects if the account already exists. Always returns ' +
      '{ email } and never issues tokens.',
  })
  @ApiCreatedResponse({
    description: 'Verification email queued.',
    schema: { type: 'object', properties: { email: { type: 'string' } } },
  })
  async googleSignUp(@Body() input: GoogleSignInDto) {
    return this.googleAuth.signUp(input);
  }

  @Public()
  @ApiOperation({
    summary: 'Admin sign-in (ADMINISTRATOR or SUPERADMIN only)',
    description:
      'Mirrors `POST /auth/sign-in` but rejects any non-admin user — ' +
      'including contributors — with `403 admin_required` after a ' +
      'successful credential match. Bad credentials still produce the ' +
      'generic `401 Invalid email or password` response.',
  })
  @ApiOkResponse({
    description: 'Tokens are set as HttpOnly cookies; body returns the user.',
    type: TokensDto,
  })
  @Post('admin/sign-in')
  @HttpCode(HttpStatus.OK)
  async adminSignIn(
    @Body() input: SignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ua = req.headers['user-agent'] ?? '';
    const tokens = await this.auth.signInAdmin({ ...input, ua });
    setAuthCookies(res, this.config, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user: { id: tokens.user.id, role: tokens.user.role },
    });
    return { user: tokens.user };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @ApiCookieAuth('refresh-cookie')
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token',
    description:
      'Consumes the refresh cookie (sent automatically by the browser) and ' +
      'issues a fresh access + refresh pair. Reuse of a revoked cookie ' +
      'revokes the entire session family and forces re-authentication.',
  })
  @ApiOkResponse({
    description: 'New token pair set as cookies; user view in body.',
    type: TokensDto,
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user as {
      sub: string;
      jti: string;
      family: string;
      presentedToken: string;
    };
    const ua = req.headers['user-agent'] ?? '';
    const tokens = await this.auth.refresh({
      sub: user.sub,
      jti: user.jti,
      family: user.family,
      presentedToken: user.presentedToken,
      ua,
    });
    setAuthCookies(res, this.config, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user: { id: tokens.user.id, role: tokens.user.role },
    });
    return { user: tokens.user };
  }

  @UseGuards(JwtAccessGuard)
  @ApiCookieAuth('access-cookie')
  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke the active refresh token and clear auth cookies',
  })
  async signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const user = req.user as { sub: string; jti?: string };
    if (user.jti) {
      await this.auth.signOut({ sub: user.sub, jti: user.jti });
    }
    clearAuthCookies(res, this.config);
  }

  @UseGuards(JwtAccessGuard)
  @ApiCookieAuth('access-cookie')
  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Change the current user password and invalidate all sessions',
  })
  async changePassword(
    @Body() body: PasswordChangeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const user = req.user as { sub: string };
    await this.auth.changePassword({
      userId: user.sub,
      currentPassword: body.current_password,
      newPassword: body.new_password,
    });
    clearAuthCookies(res, this.config);
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
