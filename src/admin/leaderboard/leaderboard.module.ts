import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LeaderboardRecord } from './leaderboard-record.entity';
import { LeaderboardController } from './leaderboard.controller';
import { PublicLeaderboardController } from '../../public/public-leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([LeaderboardRecord])],
  controllers: [LeaderboardController, PublicLeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService, TypeOrmModule],
})
export class LeaderboardModule {}
