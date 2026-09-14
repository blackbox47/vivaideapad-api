import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../common/decorators/roles.decorator';
import { ApplicationsService } from '../admin/applications/applications.service';
import {
  VerifyEmailApplicationCreateDto,
  VerifyEmailTokenQueryDto,
} from '../admin/applications/dto/applications.dto';

@ApiTags('Public')
@Controller('public/verify-email')
export class PublicVerifyEmailController {
  constructor(private readonly apps: ApplicationsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Validate a sign-up verification token',
    description:
      'Used by the /verify-email page before showing the onboarding ' +
      'application form. Does not create a session.',
  })
  @ApiOkResponse({
    description: 'Token is valid for the onboarding form',
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        display_name: { type: 'string', nullable: true },
        access_status: { type: 'string' },
        application_status: { type: 'string', nullable: true },
      },
    },
  })
  validate(@Query() query: VerifyEmailTokenQueryDto) {
    return this.apps.verifyEmailToken(query.token);
  }

  @Public()
  @Post('application')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit onboarding application via verification token',
    description:
      'Creates an applications row linked to the pending_review user so ' +
      'admins can review them in People → Applicants. Clears the token ' +
      'after a successful submit. No JWT is issued.',
  })
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
  submit(@Body() input: VerifyEmailApplicationCreateDto) {
    return this.apps.submitViaVerificationToken(input);
  }
}
