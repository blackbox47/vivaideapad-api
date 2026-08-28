import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEventsModule } from '../audit-events/audit-events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PayoutRequest } from './payout.entity';
import { LedgerEntry } from '../../contributor/entities/ledger-entry.entity';
import { PayoutsService } from './payouts.service';
import { AdminPayoutsController } from './payouts.controller';
import { WalletService } from '../../contributor/wallet.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayoutRequest, LedgerEntry]),
    AuditEventsModule,
    NotificationsModule,
  ],
  controllers: [AdminPayoutsController],
  providers: [PayoutsService, WalletService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
