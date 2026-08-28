import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConceptsModule } from '../admin/concepts/concepts.module';
import { NotificationsModule } from '../admin/notifications/notifications.module';
import { PayoutsModule } from '../admin/payouts/payouts.module';
import { LeaderboardModule } from '../admin/leaderboard/leaderboard.module';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Submission } from './entities/submission.entity';
import { Notification } from '../admin/notifications/notification.entity';
import { ContributorController } from './contributor.controller';
import { SubmissionsService } from './submissions.service';
import { WalletService } from './wallet.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, LedgerEntry, Notification]),
    ConceptsModule,
    NotificationsModule,
    PayoutsModule,
    LeaderboardModule,
  ],
  controllers: [ContributorController],
  providers: [SubmissionsService, WalletService],
  exports: [SubmissionsService, WalletService, TypeOrmModule],
})
export class ContributorModule {}
