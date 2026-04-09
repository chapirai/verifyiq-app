import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulkController } from './bulk.controller';
import { BulkService } from './bulk.service';
import { BulkJobEntity } from './entities/bulk-job.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BulkJobEntity])],
  controllers: [BulkController],
  providers: [BulkService],
  exports: [BulkService],
})
export class BulkModule {}
