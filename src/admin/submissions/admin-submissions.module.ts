import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEventsModule } from '../audit-events/audit-events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { Submission } from '../../contributor/entities/submission.entity';
import { LedgerEntry } from '../../contributor/entities/ledger-entry.entity';
import { Concept } from '../concepts/concept.entity';
import { User } from '../../users/entities/user.entity';
import { AdminSubmissionsController } from './admin-submissions.controller';
import { AdminSubmissionsService } from './admin-submissions.service';
import { WalletService } from '../../contributor/wallet.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, LedgerEntry, Concept, User]),
    AuditEventsModule,
    NotificationsModule,
    LeaderboardModule,
  ],
  controllers: [AdminSubmissionsController],
  providers: [AdminSubmissionsService, WalletService],
  exports: [AdminSubmissionsService, WalletService],
})
export class AdminSubmissionsModule {}
