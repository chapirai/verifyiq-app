import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { PartiesController } from './parties.controller';
import { PartiesService } from './parties.service';
import { PartyEntity } from './party.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PartyEntity]), AuditModule],
  controllers: [PartiesController],
  providers: [PartiesService],
  exports: [PartiesService, TypeOrmModule],
})
export class PartiesModule {}
