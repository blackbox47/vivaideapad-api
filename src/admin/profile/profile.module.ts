import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../users/entities/user.entity';
import { UsersModule } from '../../users/users.module';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { AdminUsersModule } from '../users/admin-users.module';
import { UploadsModule } from '../../uploads/uploads.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    UsersModule,
    AuditEventsModule,
    AdminUsersModule,
    UploadsModule,
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
