import { Module } from '@nestjs/common';

import { ConsoleMailerService, MAILER_SERVICE } from './mailer.service';

@Module({
  providers: [
    ConsoleMailerService,
    { provide: MAILER_SERVICE, useClass: ConsoleMailerService },
  ],
  exports: [MAILER_SERVICE],
})
export class MailerModule {}
