import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Category } from './category.entity';
import { CategoriesService } from './categories.service';
import { AdminCategoriesController } from './categories.controller';
import { PublicCategoriesController } from '../../public/categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Category])],
  controllers: [AdminCategoriesController, PublicCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService, TypeOrmModule],
})
export class CategoriesModule {}
