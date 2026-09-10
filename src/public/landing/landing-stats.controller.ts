import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { Public } from '../../common/decorators/roles.decorator';

export interface LandingStatsData {
  activeRequests: number;
  ideasSubmitted: number;
  totalPrizes: number;
  ideasRewardedUsd: number;
  ideasCount: number;
  approvalRatePct: number;
  avgReviewTurnaroundHours: number | null;
}

@ApiTags('Public')
@Controller('public/landing/stats')
export class LandingStatsController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get landing page aggregate stats' })
  @ApiOkResponse({ description: 'Landing stats data' })
  async getStats(): Promise<{ data: LandingStatsData }> {
    const [conceptsRes, submissionsRes, payoutsRes] = await Promise.all([
      this.dataSource.query(`
        SELECT 
          COUNT(CASE WHEN (status = 'active' OR status = 'published') AND (close_date IS NULL OR close_date > NOW()) THEN 1 END) AS active_requests,
          COALESCE(SUM(CASE WHEN (status = 'active' OR status = 'published') AND (close_date IS NULL OR close_date > NOW()) THEN CAST(reward_budget AS DECIMAL(14,2)) ELSE 0 END), 0) AS total_prizes
        FROM concepts
        WHERE deleted_at IS NULL
      `),
      this.dataSource.query(`
        SELECT
          COUNT(*) AS total_submissions,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved_submissions,
          AVG(CASE WHEN decided_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, created_at, decided_at) END) AS avg_turnaround_seconds
        FROM submissions
        WHERE deleted_at IS NULL
      `),
      this.dataSource.query(`
        SELECT
          COALESCE(SUM(CAST(amount AS DECIMAL(14,2))), 0) AS ideas_rewarded_usd
        FROM payout_requests
        WHERE status = 'paid' AND deleted_at IS NULL
      `),
    ]);

    const cRow = conceptsRes?.[0] || {};
    const sRow = submissionsRes?.[0] || {};
    const pRow = payoutsRes?.[0] || {};

    const activeRequests = Number(cRow.active_requests ?? 0);
    const totalPrizes = Number(cRow.total_prizes ?? 0);
    const ideasSubmitted = Number(sRow.total_submissions ?? 0);
    const approvedSubmissions = Number(sRow.approved_submissions ?? 0);
    const ideasRewardedUsd = Number(pRow.ideas_rewarded_usd ?? 0);
    const ideasCount = ideasSubmitted;

    const approvalRatePct =
      ideasSubmitted > 0
        ? Number(((approvedSubmissions / ideasSubmitted) * 100).toFixed(1))
        : 0;

    const avgTurnaroundSeconds =
      sRow.avg_turnaround_seconds != null
        ? Number(sRow.avg_turnaround_seconds)
        : null;
    const avgReviewTurnaroundHours =
      avgTurnaroundSeconds != null
        ? Number((avgTurnaroundSeconds / 3600).toFixed(1))
        : null;

    return {
      data: {
        activeRequests,
        ideasSubmitted,
        totalPrizes,
        ideasRewardedUsd,
        ideasCount,
        approvalRatePct,
        avgReviewTurnaroundHours,
      },
    };
  }
}
