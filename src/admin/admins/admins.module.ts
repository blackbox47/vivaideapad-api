import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../users/entities/user.entity';
import { UsersModule } from '../../users/users.module';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), UsersModule, AuditEventsModule],
  controllers: [AdminsController],
  providers: [AdminsService],
})
export class AdminsModule {}
