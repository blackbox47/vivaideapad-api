import { Injectable, Logger } from '@nestjs/common';

export const MAILER_SERVICE = Symbol('MAILER_SERVICE');

export interface MailerService {
  sendVerificationLink(input: {
    email: string;
    displayName: string | null;
    token: string;
  }): Promise<void>;
}

@Injectable()
export class ConsoleMailerService implements MailerService {
  private readonly logger = new Logger(ConsoleMailerService.name);

  async sendVerificationLink(input: {
    email: string;
    displayName: string | null;
    token: string;
  }): Promise<void> {
    await Promise.resolve();
    const verifyUrl = `${process.env.APP_PUBLIC_URL ?? 'http://localhost:5173'}/verify-email?token=${input.token}`;
    this.logger.log(
      `[verify] would email ${input.email} (${input.displayName ?? 'no name'}) link=${verifyUrl}`,
    );
  }
}
