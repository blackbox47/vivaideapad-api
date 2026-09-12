import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import {
  LEDGER_ENTRY_STATUSES,
  LEDGER_ENTRY_TYPES,
} from '../../../contributor/entities/ledger-entry.entity';

export const AdminLedgerListQuerySchema = z.object({
  user_id: z.uuid().optional(),
  type: z.enum(LEDGER_ENTRY_TYPES).optional(),
  status: z.enum(LEDGER_ENTRY_STATUSES).optional(),
  date_from: z.iso.datetime().optional(),
  date_to: z.iso.datetime().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});
export class AdminLedgerListQueryDto extends createZodDto(
  AdminLedgerListQuerySchema,
) {}

export const ManualAdjustmentSchema = z.object({
  user_id: z.uuid(),
  type: z.enum([
    'reward_credit',
    'manual_adjustment',
    'fee',
    'payout_reversal',
  ]),
  amount: z.coerce.number().refine((n) => n !== 0, 'amount must not be 0'),
  reference: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
});
export class ManualAdjustmentDto extends createZodDto(ManualAdjustmentSchema) {}

const IdParamSchema = z.object({ id: z.uuid() });
export class LedgerIdParamDto extends createZodDto(IdParamSchema) {}
