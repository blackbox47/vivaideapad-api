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
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { IdeasService } from './ideas.service';
import {
  CreateIdeaDto,
  IdeaDto,
  UpdateIdeaDto,
} from './dto/ideas.dto';

@ApiTags('Ideas')
@Controller('ideas')
export class IdeasController {
  constructor(private readonly ideasService: IdeasService) {}

  @Get()
  @ApiOperation({ summary: 'List all ideas' })
  @ApiOkResponse({ description: 'All ideas', type: IdeaDto })
  findAll() {
    return this.ideasService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single idea by id' })
  @ApiParam({ name: 'id', type: String, description: 'Idea UUID' })
  @ApiOkResponse({ description: 'The idea', type: IdeaDto })
  findOne(@Param('id') id: string) {
    return this.ideasService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new idea' })
  @ApiCreatedResponse({ description: 'Idea created', type: IdeaDto })
  create(@Body() input: CreateIdeaDto) {
    return this.ideasService.create(input);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing idea' })
  @ApiParam({ name: 'id', type: String, description: 'Idea UUID' })
  @ApiOkResponse({ description: 'Updated idea', type: IdeaDto })
  update(@Param('id') id: string, @Body() input: UpdateIdeaDto) {
    return this.ideasService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an idea' })
  @ApiParam({ name: 'id', type: String, description: 'Idea UUID' })
  @ApiNoContentResponse({ description: 'Idea deleted' })
  remove(@Param('id') id: string): Promise<void> {
    return this.ideasService.remove(id);
  }
}
