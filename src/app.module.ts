import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { IdeasModule } from './ideas/ideas.module';

@Module({
  imports: [DatabaseModule, IdeasModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}