import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { IdeasModule } from './ideas/ideas.module';

@Module({
  imports: [PrismaModule, IdeasModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}