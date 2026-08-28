import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { USER_ROLES } from '../../users/entities/user.entity';
import { PeopleService, PeopleResponse } from './people.service';

/**
 * Aggregate endpoint backing the admin "People" page in the SPA.
 *
 * Returns a denormalized snapshot of applicants + platform users in a single
 * round-trip so the UI's three tabs (Applicants / Invited / Contributors)
 * render without waterfall fetches.
 *
 * Authorization: ADMINISTRATOR (SUPERADMIN inherits via the hierarchical
 * RBAC in RolesGuard).
 */
@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller('admin/people')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  @ApiOperation({
    summary:
      'People overview snapshot — applicants + platform users, single payload',
  })
  @ApiOkResponse({ description: 'Applicants and platform users snapshot' })
  async snapshot(): Promise<PeopleResponse> {
    return this.people.snapshot();
  }
}
