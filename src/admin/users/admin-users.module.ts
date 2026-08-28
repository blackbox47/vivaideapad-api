import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../../users/users.module';
import { User } from '../../users/entities/user.entity';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    UsersModule,
    AuditEventsModule,
    NotificationsModule,
  ],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
