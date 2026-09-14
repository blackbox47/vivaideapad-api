import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const MAILER_SERVICE = Symbol('MAILER_SERVICE');

export interface MailerService {
  sendVerificationLink(input: {
    email: string;
    displayName: string | null;
    token: string;
  }): Promise<void>;

  sendApprovalInvite(input: {
    email: string;
    displayName: string | null;
  }): Promise<void>;

  sendPasswordResetLink(input: {
    email: string;
    displayName: string | null;
    token: string;
  }): Promise<void>;
}

/**
 * Builds the SPA onboarding URL opened from sign-up emails.
 * Always targets `/verify-email?token=...` (email + Google paths share this).
 */
export function buildVerifyEmailUrl(
  publicBaseUrl: string,
  token: string,
): string {
  const base = publicBaseUrl.trim().replace(/\/+$/, '') || 'http://localhost:5173';
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

/** Builds the contributor sign-in URL used in approval emails. */
export function buildSignInUrl(publicBaseUrl: string): string {
  const base = publicBaseUrl.trim().replace(/\/+$/, '') || 'http://localhost:5173';
  return `${base}/login`;
}

/** Builds the password-reset URL opened from forgot-password emails. */
export function buildPasswordResetUrl(
  publicBaseUrl: string,
  token: string,
): string {
  const base = publicBaseUrl.trim().replace(/\/+$/, '') || 'http://localhost:5173';
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

@Injectable()
export class ConsoleMailerService implements MailerService {
  private readonly logger = new Logger(ConsoleMailerService.name);

  constructor(private readonly config: ConfigService) {}

  private publicUrl(): string {
    return (
      this.config.get<string>('app.publicUrl') ??
      process.env.APP_PUBLIC_URL ??
      'http://localhost:5173'
    );
  }

  async sendVerificationLink(input: {
    email: string;
    displayName: string | null;
    token: string;
  }): Promise<void> {
    await Promise.resolve();
    const verifyUrl = buildVerifyEmailUrl(this.publicUrl(), input.token);
    this.logger.log(
      `[verify] would email ${input.email} (${input.displayName ?? 'no name'}) link=${verifyUrl}`,
    );
  }

  async sendApprovalInvite(input: {
    email: string;
    displayName: string | null;
  }): Promise<void> {
    await Promise.resolve();
    const signInUrl = buildSignInUrl(this.publicUrl());
    this.logger.log(
      `[approved] would email ${input.email} (${input.displayName ?? 'no name'}) sign-in=${signInUrl}`,
    );
  }

  async sendPasswordResetLink(input: {
    email: string;
    displayName: string | null;
    token: string;
  }): Promise<void> {
    await Promise.resolve();
    const resetUrl = buildPasswordResetUrl(this.publicUrl(), input.token);
    this.logger.log(
      `[password-reset] would email ${input.email} (${input.displayName ?? 'no name'}) link=${resetUrl}`,
    );
  }
}
