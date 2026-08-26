import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// ---------- Input DTOs ----------

export const CreateIdeaSchema = z.object({
  title: z
    .string()
    .min(1, 'title must not be empty')
    .max(200, 'title must be at most 200 characters'),
  description: z.string().max(2000).optional(),
});

export class CreateIdeaDto extends createZodDto(CreateIdeaSchema) {}

export const UpdateIdeaSchema = z.object({
  title: z
    .string()
    .min(1, 'title must not be empty')
    .max(200, 'title must be at most 200 characters')
    .optional(),
  description: z.string().max(2000).optional(),
});

export class UpdateIdeaDto extends createZodDto(UpdateIdeaSchema) {}

// ---------- Response DTO ----------

export const IdeaSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export class IdeaDto extends createZodDto(IdeaSchema) {}

// ---------- Route param DTOs ----------

export const IdParamSchema = z.object({
  id: z.uuid({ message: 'id must be a UUID' }),
});

export class IdParamDto extends createZodDto(IdParamSchema) {}