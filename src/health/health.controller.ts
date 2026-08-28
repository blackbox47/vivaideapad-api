import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

import { Public } from '../common/decorators/roles.decorator';

@ApiTags('Health')
@Controller('health')
@Public()
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Liveness + DB readiness probe' })
  @ApiOkResponse({
    description: 'Service health',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        db: { type: 'string', example: 'up' },
        version: { type: 'string', example: '1.0.0' },
      },
    },
  })
  async ping() {
    let dbStatus: 'up' | 'down' = 'down';
    try {
      await this.dataSource.query('SELECT 1');
      dbStatus = 'up';
    } catch {
      dbStatus = 'down';
    }
    return {
      status: dbStatus === 'up' ? 'ok' : 'degraded',
      db: dbStatus,
      version: process.env.npm_package_version ?? '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
