import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../users/entities/user.entity';
import { Category } from '../categories/category.entity';
import { Concept } from '../concepts/concept.entity';
import { Application } from '../applications/application.entity';
import { Submission } from '../../contributor/entities/submission.entity';
import { LedgerEntry } from '../../contributor/entities/ledger-entry.entity';
import { PayoutRequest } from '../payouts/payout.entity';
import { Notification } from '../notifications/notification.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Category,
      Concept,
      Application,
      Submission,
      LedgerEntry,
      PayoutRequest,
      Notification,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
