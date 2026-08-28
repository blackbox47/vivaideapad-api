import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/roles.decorator';

import { ApplicationsService } from '../admin/applications/applications.service';
import { PublicCreateApplicationDto } from '../admin/applications/dto/applications.dto';

@ApiTags('Public')
@Controller('public/applications')
export class PublicApplicationsController {
  constructor(private readonly apps: ApplicationsService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a public application' })
  @ApiCreatedResponse({
    description: 'Application received',
    schema: {
      type: 'object',
      properties: {
        reference_number: { type: 'string' },
        application: { type: 'object' },
      },
    },
  })
  create(@Body() input: PublicCreateApplicationDto) {
    return this.apps.publicApply(input);
  }

  @Public()
  @Get(':referenceNumber')
  @ApiOperation({ summary: 'Look up application status by reference' })
  @ApiOkResponse({ description: 'Current application status' })
  status(@Param('referenceNumber') referenceNumber: string) {
    return this.apps.publicStatus(referenceNumber);
  }
}
