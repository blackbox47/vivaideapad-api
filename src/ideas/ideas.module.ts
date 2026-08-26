import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Idea } from './idea.entity';
import { IdeasController } from './ideas.controller';
import { IdeasService } from './ideas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Idea])],
  controllers: [IdeasController],
  providers: [IdeasService],
})
export class IdeasModule {}