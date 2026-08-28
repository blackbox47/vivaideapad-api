import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../users/entities/user.entity';
import { Category } from '../categories/category.entity';
import { Submission } from '../../contributor/entities/submission.entity';
import { LedgerEntry } from '../../contributor/entities/ledger-entry.entity';
import { PayoutRequest } from '../payouts/payout.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Category,
      Submission,
      LedgerEntry,
      PayoutRequest,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
