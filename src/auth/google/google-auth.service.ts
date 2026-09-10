import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

import { ApiException } from '../../common/exceptions/api-exception';
import { UsersService } from '../../users/users.service';
import { User, USER_ROLES } from '../../users/entities/user.entity';
import { AuthService, AuthTokens } from '../auth.service';

export const GOOGLE_OAUTH_CLIENT = 'GOOGLE_OAUTH_CLIENT';

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly clientId: string;

  constructor(
    private readonly users: UsersService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    @Inject(GOOGLE_OAUTH_CLIENT)
    private readonly oauthClient: OAuth2Client,
  ) {
    this.clientId =
      this.config.get<string>('google.clientId') ??
      process.env.GOOGLE_CLIENT_ID ??
      '';
  }

  async signIn(input: {
    credential: string;
    ua?: string;
  }): Promise<AuthTokens> {
    let payload;
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken: input.credential,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      this.logger.warn(
        `Google token verification failed: ${(err as Error).message}`,
      );
      throw ApiException.unauthorized('Invalid Google credential token');
    }

    if (!payload || !payload.sub || !payload.email) {
      throw ApiException.unauthorized('Google token missing required claims');
    }

    if (payload.email_verified !== true) {
      throw ApiException.forbidden(
        'google_email_not_verified',
        'Google account email is not verified',
      );
    }

    const email = payload.email.toLowerCase();
    const existingUser = await this.users.findByEmail(email);

    let user: User;

    if (!existingUser) {
      // New creator user creation
      user = await this.users.createGoogleIdentity({
        email,
        googleId: payload.sub,
        displayName: payload.name ?? null,
        avatarUrl: payload.picture ?? null,
      });
    } else {
      // Existing user: check role restriction
      if (existingUser.role !== USER_ROLES.CONTRIBUTOR) {
        throw ApiException.forbidden(
          'admin_required',
          'Admin accounts must use email and password',
        );
      }

      // Check Google ID matching / linking
      if (!existingUser.googleId) {
        await this.users.setGoogleId(existingUser.id, payload.sub);
        existingUser.googleId = payload.sub;
        user = existingUser;
      } else if (existingUser.googleId === payload.sub) {
        user = existingUser;
      } else {
        throw ApiException.conflict(
          'google_account_conflict',
          'This email is already linked to a different Google account',
        );
      }
    }

    // Delegate token minting, suspended check, and cookie data creation to AuthService
    return this.authService.signInForExistingUser(user, input.ua);
  }
}
