import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

/**
 * Legacy PATCH body used by `useDecideSubmissionMutation` in the SPA
 * (vivaideapad-admin/src/services/content-review/content-review-service.ts:65-72).
 *
 * The frontend speaks the wire enum `SubmissionStatus` from
 * `vivaideapad-admin/src/models/content-review/content-review-model.ts:3-8`,
 * including `'Published'` which is a separate spec-aligned endpoint
 * (POST /admin/submissions/:id/publish). The service layer rejects
 * `Published` so the legacy path doesn't silently no-op on it.
 */
export const ReviewQueueDecideSchema = z.object({
  id: z.uuid(),
  status: z.enum([
    'Under Review',
    'Revision Requested',
    'Approved',
    'Published',
    'Rejected',
  ]),
  comment: z.string().max(2000).optional(),
});
export class ReviewQueueDecideDto extends createZodDto(
  ReviewQueueDecideSchema,
) {}
