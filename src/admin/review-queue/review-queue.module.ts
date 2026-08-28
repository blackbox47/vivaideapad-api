import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../users/entities/user.entity';
import { Submission } from '../../contributor/entities/submission.entity';
import { Concept } from '../concepts/concept.entity';
import { AdminSubmissionsModule } from '../submissions/admin-submissions.module';
import { ReviewQueueController } from './review-queue.controller';
import { ReviewQueueService } from './review-queue.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, User, Concept]),
    // Reuse AdminSubmissionsService.decide() for atomic side-effects
    // (ledger entry + leaderboard upsert + audit row + notification).
    AdminSubmissionsModule,
  ],
  controllers: [ReviewQueueController],
  providers: [ReviewQueueService],
})
export class ReviewQueueModule {}
