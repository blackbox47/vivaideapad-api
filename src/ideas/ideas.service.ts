import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateIdeaDto, UpdateIdeaDto } from './dto/ideas.dto';
import { Idea } from './idea.entity';

@Injectable()
export class IdeasService {
  constructor(
    @InjectRepository(Idea)
    private readonly ideas: Repository<Idea>,
  ) {}

  findAll(): Promise<Idea[]> {
    return this.ideas.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Idea> {
    const idea = await this.ideas.findOne({ where: { id } });
    if (!idea) {
      throw new NotFoundException(`Idea #${id} not found`);
    }
    return idea;
  }

  create(input: CreateIdeaDto): Promise<Idea> {
    const entity = this.ideas.create(input);
    return this.ideas.save(entity);
  }

  async update(id: string, input: UpdateIdeaDto): Promise<Idea> {
    const idea = await this.ideas.preload({ id, ...input });
    if (!idea) {
      throw new NotFoundException(`Idea #${id} not found`);
    }
    return this.ideas.save(idea);
  }

  async remove(id: string): Promise<void> {
    const result = await this.ideas.delete({ id });
    if (!result.affected) {
      throw new NotFoundException(`Idea #${id} not found`);
    }
  }
}
