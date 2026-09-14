import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Concept } from './concept.entity';
import { ConceptsService } from './concepts.service';
import { AdminConceptsController } from './concepts.controller';
import { PublicConceptsController } from '../../public/concepts.controller';
import { Submission } from '../../contributor/entities/submission.entity';
import { AuditEventsModule } from '../audit-events/audit-events.module';

@Module({
  imports: [TypeOrmModule.forFeature([Concept, Submission]), AuditEventsModule],
  controllers: [AdminConceptsController, PublicConceptsController],
  providers: [ConceptsService],
  exports: [ConceptsService, TypeOrmModule],
})
export class ConceptsModule {}
