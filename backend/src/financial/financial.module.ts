import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { CreditRatingEntity } from './entities/credit-rating.entity';
import { FinancialStatementEntity } from './entities/financial-statement.entity';
import { FinancialController } from './financial.controller';
import { FinancialService } from './financial.service';

@Module({
  imports: [TypeOrmModule.forFeature([FinancialStatementEntity, CreditRatingEntity]), AuditModule],
  controllers: [FinancialController],
  providers: [FinancialService],
  exports: [FinancialService],
})
export class FinancialModule {}
