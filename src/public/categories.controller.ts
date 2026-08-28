import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/roles.decorator';
import { CategoriesService } from '../admin/categories/categories.service';

@ApiTags('Public')
@Controller('public/categories')
export class PublicCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active categories for public browse' })
  @ApiOkResponse({ description: 'Active categories' })
  async list() {
    const data = await this.categories.findActive();
    return { data };
  }
}
