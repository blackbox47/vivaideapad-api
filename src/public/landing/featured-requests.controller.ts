import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { Public } from '../../common/decorators/roles.decorator';

const FeaturedRequestsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).default(3),
});

export class FeaturedRequestsQueryDto extends createZodDto(
  FeaturedRequestsQuerySchema,
) {}

export interface FeaturedRequestItem {
  id: string;
  category: string;
  daysLeft: number;
  title: string;
  description: string;
  tags: string[];
  postedBy: string;
  amount: number;
  ideas: number;
}

@ApiTags('Public')
@Controller('public/landing/featured-requests')
export class FeaturedRequestsController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List public featured requests for landing page' })
  @ApiOkResponse({ description: 'List of featured opportunities' })
  async getFeaturedRequests(
    @Query() query: FeaturedRequestsQueryDto,
  ): Promise<{ data: FeaturedRequestItem[] }> {
    const limit = Math.max(1, Math.min(12, query.limit ?? 3));

    const concepts = await this.dataSource.query(
      `
      SELECT
        c.id,
        c.title,
        c.brief,
        c.reward_budget,
        c.status,
        c.metadata,
        c.open_date,
        c.close_date,
        cat.name AS category_name
      FROM concepts c
      LEFT JOIN categories cat ON cat.id = c.category_id AND cat.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
        AND c.status IN ('active', 'published')
        AND (c.close_date IS NULL OR c.close_date > NOW())
      ORDER BY
        CASE WHEN c.close_date IS NULL THEN 1 ELSE 0 END ASC,
        c.close_date ASC,
        c.created_at DESC
      LIMIT ?
    `,
      [limit],
    );

    if (!concepts || concepts.length === 0) {
      return { data: [] };
    }

    const conceptIds = concepts.map((c: { id: string }) => c.id);

    // Count submissions per concept
    const submissionCounts: Array<{ concept_id: string; cnt: string }> =
      await this.dataSource.query(
        `
        SELECT concept_id, COUNT(*) AS cnt
        FROM submissions
        WHERE concept_id IN (?)
          AND deleted_at IS NULL
        GROUP BY concept_id
      `,
        [conceptIds],
      );

    const countMap = new Map<string, number>();
    for (const sc of submissionCounts) {
      countMap.set(sc.concept_id, Number(sc.cnt ?? 0));
    }

    const now = Date.now();
    const data: FeaturedRequestItem[] = concepts.map(
      (c: Record<string, unknown>) => {
        const id = String(c.id);
        const category =
          typeof c.category_name === 'string' ? c.category_name : 'General';
        const title = typeof c.title === 'string' ? c.title : '';

        // Trim brief to ~180 chars with ellipsis
        const brief = typeof c.brief === 'string' ? c.brief.trim() : '';
        const description =
          brief.length > 180 ? `${brief.slice(0, 177)}...` : brief;

        // Parse metadata
        let metadata: Record<string, unknown> | null = null;
        if (typeof c.metadata === 'string') {
          try {
            metadata = JSON.parse(c.metadata);
          } catch {
            metadata = null;
          }
        } else if (c.metadata && typeof c.metadata === 'object') {
          metadata = c.metadata as Record<string, unknown>;
        }

        // Tags
        const rawTags = metadata?.tags;
        const tags = Array.isArray(rawTags) ? rawTags.map(String) : [];

        // Posted by fallback
        const postedBy =
          (typeof metadata?.postedBy === 'string' && metadata.postedBy) ||
          (typeof metadata?.posted_by === 'string' && metadata.posted_by) ||
          (typeof metadata?.vendor === 'string' && metadata.vendor) ||
          (typeof metadata?.company === 'string' && metadata.company) ||
          'Sparkory';

        // Days left clamped to 0
        let daysLeft = 0;
        if (c.close_date) {
          const closeTime = new Date(c.close_date as string | Date).getTime();
          const diffMs = closeTime - now;
          daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        }

        const amount = Number(c.reward_budget ?? 0);
        const ideas = countMap.get(id) ?? 0;

        return {
          id,
          category,
          daysLeft,
          title,
          description,
          tags,
          postedBy,
          amount,
          ideas,
        };
      },
    );

    return { data };
  }
}
