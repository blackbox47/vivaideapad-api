import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { appConfig, jwtConfig, uploadsConfig } from './config/app.config';
import { validateEnv } from './config/env.schema';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './admin/categories/categories.module';
import { ConceptsModule } from './admin/concepts/concepts.module';
import { ApplicationsModule } from './admin/applications/applications.module';
import { AuditEventsModule } from './admin/audit-events/audit-events.module';
import { NotificationsModule } from './admin/notifications/notifications.module';
import { AdminNotificationsModule } from './admin/notifications/admin-notifications.module';
import { ContributorModule } from './contributor/contributor.module';
import { AdminSubmissionsModule } from './admin/submissions/admin-submissions.module';
import { LeaderboardModule } from './admin/leaderboard/leaderboard.module';
import { PayoutsModule } from './admin/payouts/payouts.module';
import { PeopleModule } from './admin/people/people.module';
import { ReviewQueueModule } from './admin/review-queue/review-queue.module';
import { UploadsModule } from './uploads/uploads.module';
import { AdminUsersModule } from './admin/users/admin-users.module';
import { ProfileModule } from './admin/profile/profile.module';
import { DashboardModule } from './admin/dashboard/dashboard.module';
import { ReportsModule } from './admin/reports/reports.module';
import { LedgerAdminModule } from './admin/ledger/ledger-admin.module';
import { AdminsModule } from './admin/admins/admins.module';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtAccessGuard } from './auth/guards/jwt-access.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Namespaces: consumers read via ConfigService.get('jwt.accessSecret') etc.
      load: [appConfig, jwtConfig, uploadsConfig],
      // Boot-time validation — missing/malformed env vars fail here, not later
      // inside a strategy constructor or service.
      validate: validateEnv,
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    ConceptsModule,
    AuditEventsModule,
    NotificationsModule,
    AdminNotificationsModule,
    LeaderboardModule,
    ApplicationsModule,
    PayoutsModule,
    PeopleModule,
    ReviewQueueModule,
    ContributorModule,
    AdminSubmissionsModule,
    UploadsModule,
    AdminUsersModule,
    ProfileModule,
    DashboardModule,
    ReportsModule,
    LedgerAdminModule,
    AdminsModule,
  ],
  providers: [
    {
      // 1) Authenticate the bearer token (skipped when @Public()).
      provide: APP_GUARD,
      useClass: JwtAccessGuard,
    },
    {
      // 2) Authorize based on @Roles metadata (skipped when @Public()).
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
