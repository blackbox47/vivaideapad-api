import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { Public } from '../common/decorators/roles.decorator';
import {
  buildPaginationMeta,
  parsePagination,
} from '../common/utils/pagination';
import { ApiException } from '../common/exceptions/api-exception';
import { ConceptsService } from '../admin/concepts/concepts.service';

const PublicConceptListQuerySchema = z.object({
  category_id: z.uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});

export class PublicConceptListQueryDto extends createZodDto(
  PublicConceptListQuerySchema,
) {}

const ConceptIdParamSchema = z.object({ id: z.uuid() });
class ConceptIdParamDto extends createZodDto(ConceptIdParamSchema) {}

@ApiTags('Public')
@Controller('public/concepts')
export class PublicConceptsController {
  constructor(private readonly concepts: ConceptsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List published concepts' })
  @ApiOkResponse({ description: 'Paginated published concepts' })
  async list(@Query() query: PublicConceptListQueryDto) {
    const { page, limit } = parsePagination(query);
    const { data, total } = await this.concepts.findPublished({
      category_id: query.category_id,
      page,
      limit,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a published concept' })
  @ApiOkResponse({ description: 'The published concept' })
  async get(@Param() params: ConceptIdParamDto) {
    const found = await this.concepts.findOne(params.id);
    if (found.status !== 'published') {
      throw ApiException.notFound('Concept');
    }
    return found;
  }
}
