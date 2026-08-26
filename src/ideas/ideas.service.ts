import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIdeaDto, UpdateIdeaDto } from './dto/ideas.dto';
import type { Idea } from '@prisma/client';

@Injectable()
export class IdeasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Idea[]> {
    return this.prisma.idea.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string): Promise<Idea> {
    const idea = await this.prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      throw new NotFoundException(`Idea #${id} not found`);
    }
    return idea;
  }

  async create(input: CreateIdeaDto): Promise<Idea> {
    return this.prisma.idea.create({ data: input });
  }

  async update(id: string, input: UpdateIdeaDto): Promise<Idea> {
    try {
      return await this.prisma.idea.update({ where: { id }, data: input });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`Idea #${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.idea.delete({ where: { id } });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundException(`Idea #${id} not found`);
      }
      throw error;
    }
  }
}
