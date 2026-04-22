import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionEntity } from '../billing/entities/subscription.entity';
import { ScopeGuard } from './guards/scope.guard';
import { ApiQuotaInterceptor } from './interceptors/api-quota.interceptor';
import { ApiQuotaService } from './services/api-quota.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionEntity])],
  providers: [ApiQuotaService, ApiQuotaInterceptor, ScopeGuard],
  exports: [ApiQuotaService, ApiQuotaInterceptor, ScopeGuard],
})
export class ApiQuotaModule {}
