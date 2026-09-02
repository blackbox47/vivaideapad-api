import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const PaymentMethodSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  is_active: z.boolean(),
  sort_order: z.number().int(),
  account_hint: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

export class PaymentMethodDto extends createZodDto(PaymentMethodSchema) {}

export const CreatePaymentMethodSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'code must only contain alphanumeric characters, underscores, and dashes',
    ),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  icon: z.string().max(512).optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
  account_hint: z.string().max(120).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export class CreatePaymentMethodDto extends createZodDto(
  CreatePaymentMethodSchema,
) {}

export const UpdatePaymentMethodSchema = CreatePaymentMethodSchema.partial();
export class UpdatePaymentMethodDto extends createZodDto(
  UpdatePaymentMethodSchema,
) {}

export const PaymentMethodListQuerySchema = z.object({
  search: z.string().optional(),
  is_active: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});

export class PaymentMethodListQueryDto extends createZodDto(
  PaymentMethodListQuerySchema,
) {}

export const PaymentMethodIdParamSchema = z.object({
  id: z.uuid({ message: 'id must be a UUID' }),
});
export class PaymentMethodIdParamDto extends createZodDto(
  PaymentMethodIdParamSchema,
) {}
