import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../users/entities/user.entity';
import { AuditEvent } from './audit-event.entity';
import { AuditEventsService } from './audit-events.service';
import { AdminAuditEventsController } from './audit-events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent, User])],
  controllers: [AdminAuditEventsController],
  providers: [AuditEventsService],
  exports: [AuditEventsService, TypeOrmModule],
})
export class AuditEventsModule {}
