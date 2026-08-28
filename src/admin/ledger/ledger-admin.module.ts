import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEventsModule } from '../audit-events/audit-events.module';
import { LedgerEntry } from '../../contributor/entities/ledger-entry.entity';
import { LedgerAdminService } from './ledger-admin.service';
import { AdminLedgerController } from './ledger-admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerEntry]), AuditEventsModule],
  controllers: [AdminLedgerController],
  providers: [LedgerAdminService],
  exports: [LedgerAdminService],
})
export class LedgerAdminModule {}
