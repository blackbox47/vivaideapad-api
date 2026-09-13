import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../users/entities/user.entity';
import { UsersModule } from '../../users/users.module';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { Category } from '../categories/category.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Application } from './application.entity';
import { ApplicationsService } from './applications.service';
import { AdminApplicationsController } from './admin-applications.controller';
import { PublicApplicationsController } from '../../public/applications.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, User, Category]),
    UsersModule,
    AuditEventsModule,
    NotificationsModule,
  ],
  controllers: [AdminApplicationsController, PublicApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
