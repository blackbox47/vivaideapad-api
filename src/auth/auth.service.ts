import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import ms from 'ms';

import { ApiException } from '../common/exceptions/api-exception';
import { UsersService } from '../users/users.service';
import { User, UserRole, USER_ROLES } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import type { JwtAccessPayload } from './strategies/jwt-access.strategy';
import type { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';
import { parseTtl, parseTtlSeconds } from './auth.service-helpers';

export interface AuthUserView {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url?: string | null;
  role: UserRole;
  access_status: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: AuthUserView;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  // ------------------------------------------------------------------
  // Public methods
  // ------------------------------------------------------------------

  async signUp(input: {
    email: string;
    password: string;
    displayName?: string;
    role?: UserRole;
  }): Promise<User> {
    const email = input.email.toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw ApiException.conflict('email_taken', 'Email is already in use');
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    return this.users.create({
      email,
      passwordHash,
      displayName: input.displayName,
      role: input.role ?? USER_ROLES.CONTRIBUTOR,
      accessStatus: 'invited',
    });
  }

  async signIn(input: {
    email: string;
    password: string;
    ua?: string;
  }): Promise<AuthTokens> {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      throw ApiException.unauthorized('Invalid email or password');
    }
    const matches = await bcrypt.compare(input.password, user.passwordHash);
    if (!matches) {
      throw ApiException.unauthorized('Invalid email or password');
    }
    if (user.accessStatus === 'suspended') {
      throw ApiException.forbidden('account_suspended', 'Account is suspended');
    }
    return this.issueTokens(user, input.ua);
  }

  /**
   * Admin-only sign-in. Delegates credential verification to `signIn(...)`
   * so the bcrypt check + suspended-account guard stay in a single place,
   * then enforces the admin role gate AFTER a successful credential match.
   * Non-admin (e.g. CONTRIBUTOR) users are rejected with a 403 — distinct
   * from the 401 returned for bad credentials, so the SPA can show an
   * "admin access required" message and the endpoint is not appropriate
   * for password-spraying enumeration of admin accounts.
   */
  async signInAdmin(input: {
    email: string;
    password: string;
    ua?: string;
  }): Promise<AuthTokens> {
    const tokens = await this.signIn(input);
    if (
      tokens.user.role !== USER_ROLES.ADMINISTRATOR &&
      tokens.user.role !== USER_ROLES.SUPERADMIN
    ) {
      throw ApiException.forbidden(
        'admin_required',
        'Admin access is required to sign in here',
      );
    }
    return tokens;
  }

  async refresh(input: {
    sub: string;
    jti: string;
    family: string;
    presentedToken: string;
    ua?: string;
  }): Promise<AuthTokens> {
    const user = await this.users.findById(input.sub);
    if (!user) throw ApiException.unauthorized('User no longer exists');
    if (user.accessStatus === 'suspended') {
      throw ApiException.forbidden('account_suspended', 'Account is suspended');
    }

    // The strategy already verified hash matches and the row exists and is
    // not expired. Re-fetch the row here to inspect `revokedAt`: if the
    // presented token was already rotated (revoked), this is a replay —
    // revoke the entire family and reject.
    const stored = await this.refreshTokens.findOne({
      where: { id: input.jti, userId: input.sub },
    });
    if (!stored) {
      throw ApiException.unauthorized('Refresh token not recognized');
    }
    if (stored.revokedAt) {
      // Reuse of an already-rotated token: treat the family as compromised.
      await this.refreshTokens.update(
        { family: stored.family, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      throw ApiException.unauthorized(
        'Refresh token has been revoked; please sign in again',
      );
    }

    await this.refreshTokens.update(
      { id: input.jti, userId: input.sub },
      { revokedAt: new Date() },
    );
    return this.issueTokens(user, input.ua, stored.family);
  }

  async signOut(input: { sub: string; jti: string }): Promise<void> {
    await this.refreshTokens.update(
      { id: input.jti, userId: input.sub },
      { revokedAt: new Date() },
    );
  }

  async changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const user = await this.users.findById(input.userId);
    if (!user) throw ApiException.notFound('User');
    const matches = await bcrypt.compare(
      input.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      throw ApiException.validation('Current password is incorrect');
    }
    const newHash = await bcrypt.hash(input.newPassword, 10);
    await this.users.setPasswordHash(user.id, newHash);
    // Revoke all refresh tokens for this user (force re-login).
    await this.refreshTokens.update(
      { userId: user.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async forgotPassword(email: string): Promise<void> {
    // v1 stub: just acknowledge. Production should email a signed reset token.
    const user = await this.users.findByEmail(email);
    if (user) {
      const token = randomBytes(24).toString('hex');

      console.log(
        `[auth.forgotPassword] would email reset link to ${user.email} token=${token}`,
      );
    }
  }

  async resetPassword(_token: string, _newPassword: string): Promise<void> {
    // v1 stub: production would validate a stored reset token.
    void _token;
    void _newPassword;
    await Promise.resolve();
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private async issueTokens(
    user: User,
    ua?: string,
    family?: string,
  ): Promise<AuthTokens> {
    const accessTtl = this.config.get<string>(
      'jwt.accessTtl',
    ) as ms.StringValue;
    const refreshTtl = this.config.get<string>(
      'jwt.refreshTtl',
    ) as ms.StringValue;

    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: accessTtl,
    });

    const jti = randomBytes(16).toString('hex');
    // Start a new family on sign-in; reuse the caller's family on refresh
    // so that all rotated tokens in one session share an identity.
    const tokenFamily = family ?? randomBytes(16).toString('hex');
    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      jti,
      role: user.role,
      type: 'refresh',
    };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: refreshTtl,
    });

    const expiresAt = parseTtl(refreshTtl);
    await this.refreshTokens.insert({
      id: jti,
      userId: user.id,
      family: tokenFamily,
      tokenHash: await bcrypt.hash(refreshToken, 8),
      expiresAt,
      revokedAt: null,
      ua: ua?.slice(0, 64) ?? null,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: parseTtlSeconds(accessTtl),
      user: {
        id: user.id,
        email: user.email,
        display_name: user.displayName,
        avatar_url: user.avatarUrl,
        role: user.role,
        access_status: user.accessStatus,
      },
    };
  }
}
