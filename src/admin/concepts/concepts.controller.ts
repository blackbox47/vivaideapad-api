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
import { ConceptsService } from './concepts.service';
import {
  BulkConceptActionDto,
  ConceptIdParamDto,
  ConceptListQueryDto,
  CreateConceptDto,
  UpdateConceptDto,
} from './dto/concepts.dto';
import { USER_ROLES } from '../../users/entities/user.entity';

@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller('admin/concepts')
export class AdminConceptsController {
  constructor(private readonly concepts: ConceptsService) {}

  @Get()
  @ApiOperation({ summary: 'List concepts (paginated)' })
  async list(@Query() query: ConceptListQueryDto) {
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.concepts.list({
      search: query.search,
      status: query.status,
      category_id: query.category_id,
      page,
      limit,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  @Post()
  @ApiOperation({ summary: 'Create a concept' })
  @ApiCreatedResponse({ description: 'Concept created' })
  async create(@Body() body: CreateConceptDto) {
    return this.concepts.create(body);
  }

  @Post('bulk-action')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perform bulk action on concepts' })
  @ApiOkResponse({ description: 'Bulk action result' })
  async bulkAction(@Body() body: BulkConceptActionDto) {
    return this.concepts.bulkAction(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a concept by id' })
  @ApiOkResponse({ description: 'The concept' })
  async get(@Param() params: ConceptIdParamDto) {
    return this.concepts.findOne(params.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a concept' })
  @ApiOkResponse({ description: 'Updated concept' })
  async update(
    @Param() params: ConceptIdParamDto,
    @Body() body: UpdateConceptDto,
  ) {
    return this.concepts.update(params.id, body);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a concept' })
  async publish(@Param() params: ConceptIdParamDto) {
    return this.concepts.publish(params.id);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a concept' })
  async close(@Param() params: ConceptIdParamDto) {
    return this.concepts.close(params.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a concept' })
  @ApiNoContentResponse({ description: 'Concept deleted' })
  async remove(@Param() params: ConceptIdParamDto): Promise<void> {
    await this.concepts.softDelete(params.id);
  }
}
