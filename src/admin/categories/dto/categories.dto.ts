import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

import { CATEGORY_STATUSES } from '../category.entity';

export const CategorySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  is_active: z.enum(CATEGORY_STATUSES),
  sort_order: z.number().int(),
  color: z.string(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

export class CategoryDto extends createZodDto(CategorySchema) {}

export const CreateCategorySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, digits, dashes'),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  is_active: z.enum(CATEGORY_STATUSES).default('active'),
  sort_order: z.number().int().min(0).default(0),
  color: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex color')
    .default('#6B7280'),
});

export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}

export const UpdateCategorySchema = CreateCategorySchema.partial();
export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}

export const CategoryListQuerySchema = z.object({
  search: z.string().optional(),
  is_active: z.enum(CATEGORY_STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});

export class CategoryListQueryDto extends createZodDto(
  CategoryListQuerySchema,
) {}

export const CategoryIdParamSchema = z.object({
  id: z.uuid({ message: 'id must be a UUID' }),
});
export class CategoryIdParamDto extends createZodDto(CategoryIdParamSchema) {}
