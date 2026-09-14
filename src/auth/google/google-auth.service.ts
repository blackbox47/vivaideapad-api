import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'crypto';

import { ApiException } from '../../common/exceptions/api-exception';
import { UsersService } from '../../users/users.service';
import { User, USER_ROLES } from '../../users/entities/user.entity';
import { AuthService, AuthTokens } from '../auth.service';
import { MAILER_SERVICE } from '../mailer/mailer.service';
import type { MailerService } from '../mailer/mailer.service';

export const GOOGLE_OAUTH_CLIENT = 'GOOGLE_OAUTH_CLIENT';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

interface ResolvedIdentity {
  user: User;
  created: boolean;
}

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
    @Inject(MAILER_SERVICE) private readonly mailer: MailerService,
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
    const { user } = await this.verifyAndResolveIdentity(input.credential);
    if (
      user.role === USER_ROLES.ADMINISTRATOR ||
      user.role === USER_ROLES.SUPERADMIN
    ) {
      throw ApiException.forbidden(
        'contributor_required',
        'Please use the admin portal to sign in with this account',
      );
    }

    // New or still-pending Google accounts cannot enter the portal yet.
    // Re-send the /verify-email link so they can complete the application.
    if (user.accessStatus === 'pending_review') {
      await this.issueOnboardingVerificationEmail(user);
      throw ApiException.forbidden(
        'account_pending_review',
        'Your account is awaiting review. We sent a link to your email — open it to submit your idea, then wait for admin approval before signing in.',
      );
    }

    return this.authService.signInForExistingUser(user, input.ua);
  }

  /**
   * Public contributor sign-up via Google. Verifies the ID token, creates
   * the user with `accessStatus = 'pending_review'`, issues a verification
   * token, and emails the /verify-email link. **Never** issues JWTs or sets
   * auth cookies.
   */
  async signUp(input: { credential: string }): Promise<{ email: string }> {
    const { user, created } = await this.verifyAndResolveIdentity(
      input.credential,
    );

    if (!created) {
      if (user.accessStatus === 'active' || user.accessStatus === 'invited') {
        throw ApiException.conflict(
          'google_already_registered',
          'This Google account is already registered. Please sign in instead.',
        );
      }
      if (user.accessStatus === 'suspended') {
        throw ApiException.forbidden(
          'account_suspended',
          'Account is suspended',
        );
      }
      // `pending_review` falls through — re-issue the token + email.
    }

    await this.issueOnboardingVerificationEmail(user);

    return { email: user.email };
  }

  /** Issue (or refresh) the onboarding verification token and email the SPA link. */
  private async issueOnboardingVerificationEmail(user: User): Promise<void> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    await this.users.setVerificationToken(user.id, token, expiresAt);
    await this.mailer.sendVerificationLink({
      email: user.email,
      displayName: user.displayName,
      token,
    });
  }

  /**
   * Verify the Google credential and resolve the matching user (existing
   * or freshly created). Shared by `signIn` and `signUp` so the identity
   * claims and account-linking logic stay in one place.
   */
  private async verifyAndResolveIdentity(
    credential: string,
  ): Promise<ResolvedIdentity> {
    let payload;
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken: credential,
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

    if (!existingUser) {
      // New creator user created via Google identity provider.
      const created = await this.users.createGoogleIdentity({
        email,
        googleId: payload.sub,
        displayName: payload.name ?? null,
        avatarUrl: payload.picture ?? null,
      });
      return { user: created, created: true };
    }

    // Existing user: link / match / conflict as the existing signIn flow.
    if (existingUser.role !== USER_ROLES.CONTRIBUTOR) {
      throw ApiException.forbidden(
        'admin_required',
        'Admin accounts must use email and password',
      );
    }

    if (!existingUser.googleId) {
      await this.users.setGoogleId(existingUser.id, payload.sub);
      existingUser.googleId = payload.sub;
      return { user: existingUser, created: false };
    }
    if (existingUser.googleId === payload.sub) {
      return { user: existingUser, created: false };
    }
    throw ApiException.conflict(
      'google_account_conflict',
      'This email is already linked to a different Google account',
    );
  }
}
