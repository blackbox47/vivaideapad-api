import { Module } from '@nestjs/common';

import { LandingStatsController } from './landing-stats.controller';
import { FeaturedRequestsController } from './featured-requests.controller';

@Module({
  controllers: [LandingStatsController, FeaturedRequestsController],
})
export class LandingModule {}
