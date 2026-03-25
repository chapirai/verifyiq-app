import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { PersonEnrichmentEntity } from './entities/person-enrichment.entity';
import { PersonEnrichmentController } from './person-enrichment.controller';
import { PersonEnrichmentService } from './person-enrichment.service';

@Module({
  imports: [TypeOrmModule.forFeature([PersonEnrichmentEntity]), AuditModule],
  controllers: [PersonEnrichmentController],
  providers: [PersonEnrichmentService],
  exports: [PersonEnrichmentService],
})
export class PersonEnrichmentModule {}
