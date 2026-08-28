import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../../users/entities/user.entity';
import { Application } from '../applications/application.entity';
import { Category } from '../categories/category.entity';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Application, Category])],
  controllers: [PeopleController],
  providers: [PeopleService],
})
export class PeopleModule {}
