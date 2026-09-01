import { Global, Module } from '@nestjs/common';

import { NotificationsStreamService } from './notifications-stream.service';

/**
 * Global module that exposes the in-process notification pub/sub bus.
 *
 * Marked @Global so both the admin-side and contributor-side controllers
 * can inject NotificationsStreamService without each feature module having
 * to import it explicitly. The service holds no DB / framework state — it's
 * pure in-process — so global is the right scope.
 */
@Global()
@Module({
  providers: [NotificationsStreamService],
  exports: [NotificationsStreamService],
})
export class NotificationsStreamModule {}
