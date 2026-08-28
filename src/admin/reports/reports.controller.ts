import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import type { Response } from 'express';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { ApiException } from '../../common/exceptions/api-exception';
import { ReportsService } from './reports.service';
import { USER_ROLES } from '../../users/entities/user.entity';

const ParticipationQuerySchema = z.object({
  cohort: z.enum(['role', 'access_status']).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});
class ParticipationQueryDto extends createZodDto(ParticipationQuerySchema) {}

const DateRangeSchema = z.object({
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});
class DateRangeDto extends createZodDto(DateRangeSchema) {}

const ExportSchema = z.object({
  report: z.enum([
    'participation',
    'quality-and-categories',
    'financial-reconciliation',
  ]),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});
class ExportDto extends createZodDto(ExportSchema) {}

@ApiTags('Admin')
@UseGuards(JwtAccessGuard)
@Roles(USER_ROLES.ADMINISTRATOR)
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Reports overview metrics' })
  async overview() {
    return this.reports.overview();
  }

  @Get()
  @ApiOperation({ summary: 'Reports overview metrics (alias)' })
  async list() {
    return this.reports.overview();
  }

  @Get('participation')
  @ApiOperation({ summary: 'Participation report (cohort breakdown)' })
  @ApiOkResponse({ description: 'Participation rows' })
  async participation(@Query() query: ParticipationQueryDto) {
    return this.reports.participation({
      cohort: query.cohort,
      date_from: query.date_from,
      date_to: query.date_to,
    });
  }

  @Get('quality-and-categories')
  @ApiOperation({ summary: 'Quality by category report' })
  async quality() {
    return this.reports.qualityByCategory();
  }

  @Get('financial-reconciliation')
  @ApiOperation({ summary: 'Financial reconciliation report' })
  async financial(@Query() query: DateRangeDto) {
    return this.reports.financialReconciliation({
      date_from: query.date_from,
      date_to: query.date_to,
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Download reports summary CSV file' })
  async exportReportGet(@Res() res: Response) {
    const file = await this.reports.exportOverviewCsv();
    res.setHeader(
      'Content-Type',
      file.options.type ?? 'text/csv; charset=utf-8',
    );
    res.setHeader(
      'Content-Disposition',
      file.options.disposition ?? 'attachment; filename="ideapad-report.csv"',
    );
    file.getStream().pipe(res);
  }

  @Post('export')
  @ApiOperation({ summary: 'Download reports summary CSV file' })
  async exportReportPost(@Res() res: Response) {
    const file = await this.reports.exportOverviewCsv();
    res.setHeader(
      'Content-Type',
      file.options.type ?? 'text/csv; charset=utf-8',
    );
    res.setHeader(
      'Content-Disposition',
      file.options.disposition ?? 'attachment; filename="ideapad-report.csv"',
    );
    file.getStream().pipe(res);
  }

  @Post('export-csv')
  @ApiOperation({ summary: 'Export a report as CSV (streams file)' })
  async exportCsv(@Query() query: ExportDto, @Res() res: Response) {
    const file = await this.reports.exportCsv({
      report: query.report,
      date_from: query.date_from,
      date_to: query.date_to,
    });
    if (!file) throw ApiException.notFound('Report');
    res.setHeader('Content-Type', file.options.type ?? 'text/csv');
    res.setHeader(
      'Content-Disposition',
      file.options.disposition ?? 'attachment; filename="report.csv"',
    );
    file.getStream().pipe(res);
  }
}
