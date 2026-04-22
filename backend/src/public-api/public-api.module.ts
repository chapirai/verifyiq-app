import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyEntity } from '../api-keys/entities/api-key.entity';
import { CompaniesModule } from '../companies/companies.module';
import { PublicSourcingController } from './public-sourcing.controller';
import { PublicApiKeyGuard } from './guards/public-api-key.guard';
import { ApiQuotaModule } from '../common/api-quota.module';

@Module({
  imports: [CompaniesModule, ApiQuotaModule, TypeOrmModule.forFeature([ApiKeyEntity])],
  controllers: [PublicSourcingController],
  providers: [PublicApiKeyGuard],
})
export class PublicApiModule {}

