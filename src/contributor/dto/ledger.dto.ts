import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import {
  LEDGER_ENTRY_STATUSES,
  LEDGER_ENTRY_TYPES,
} from '../entities/ledger-entry.entity';

export const LedgerEntrySchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  type: z.enum(LEDGER_ENTRY_TYPES),
  amount: z.string(),
  status: z.enum(LEDGER_ENTRY_STATUSES),
  reference: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  posted_at: z.iso.datetime().nullable(),
  created_at: z.iso.datetime(),
});

export class LedgerEntryDto extends createZodDto(LedgerEntrySchema) {}

export const LedgerListQuerySchema = z.object({
  type: z.enum(LEDGER_ENTRY_TYPES).optional(),
  status: z.enum(LEDGER_ENTRY_STATUSES).optional(),
  date_from: z.iso.datetime().optional(),
  date_to: z.iso.datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});
export class LedgerListQueryDto extends createZodDto(LedgerListQuerySchema) {}

export const WalletSummarySchema = z.object({
  balance: z.string(),
  pending: z.string(),
  lifetime_credits: z.string(),
  lifetime_debits: z.string(),
});
export class WalletSummaryDto extends createZodDto(WalletSummarySchema) {}
