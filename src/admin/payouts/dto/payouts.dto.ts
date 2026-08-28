import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { PAYOUT_STATUSES } from '../payout.entity';

export const PayoutSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  amount: z.string(),
  status: z.enum(PAYOUT_STATUSES),
  method: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
  decision_notes: z.string().nullable(),
  processing_reference: z.string().nullable(),
  processed_at: z.iso.datetime().nullable(),
  processed_by: z.uuid().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
export class PayoutDto extends createZodDto(PayoutSchema) {}

export const CreatePayoutSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.string().max(255).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export class CreatePayoutDto extends createZodDto(CreatePayoutSchema) {}

export const ProcessPayoutSchema = z.object({
  action: z.enum(['mark_paid', 'reject']),
  reference: z.string().max(255).optional(),
  note: z.string().max(2000).optional(),
});
export class ProcessPayoutDto extends createZodDto(ProcessPayoutSchema) {}

export const PayoutListQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.toLowerCase() === 'all') return undefined;
      const lower = val.toLowerCase();
      if (lower === 'paid') return 'paid';
      if (lower === 'rejected') return 'rejected';
      if (
        lower === 'requested' ||
        lower === 'under review' ||
        lower === 'under_review' ||
        lower === 'approved' ||
        lower === 'pending'
      ) {
        return 'pending';
      }
      return lower;
    })
    .pipe(z.enum(PAYOUT_STATUSES).optional()),
  user_id: z.uuid().optional(),
  date_from: z.iso.datetime().optional(),
  date_to: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});
export class PayoutListQueryDto extends createZodDto(PayoutListQuerySchema) {}

const IdParamSchema = z.object({ id: z.uuid() });
export class PayoutIdParamDto extends createZodDto(IdParamSchema) {}
