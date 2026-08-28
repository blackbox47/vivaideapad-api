import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  buildPaginationMeta,
  parsePagination,
} from '../../common/utils/pagination';
import { CategoriesService } from './categories.service';
import {
  CategoryIdParamDto,
  CategoryListQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/categories.dto';
import { USER_ROLES } from '../../users/entities/user.entity';

@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List categories (paginated)' })
  async list(@Query() query: CategoryListQueryDto) {
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.categories.list({
      search: query.search,
      is_active: query.is_active,
      page,
      limit,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  @Post()
  @ApiOperation({ summary: 'Create a category' })
  @ApiCreatedResponse({ description: 'Category created' })
  async create(@Body() body: CreateCategoryDto) {
    return this.categories.create(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a category by id' })
  @ApiOkResponse({ description: 'The category' })
  async get(@Param() params: CategoryIdParamDto) {
    return this.categories.findOne(params.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiOkResponse({ description: 'Updated category' })
  async update(
    @Param() params: CategoryIdParamDto,
    @Body() body: UpdateCategoryDto,
  ) {
    return this.categories.update(params.id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a category' })
  @ApiNoContentResponse({ description: 'Category deleted' })
  async remove(@Param() params: CategoryIdParamDto): Promise<void> {
    await this.categories.softDelete(params.id);
  }
}
