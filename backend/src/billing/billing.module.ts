import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { OauthModule } from '../oauth/oauth.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingWebhookEventEntity } from './entities/billing-webhook-event.entity';
import { SubscriptionEntity } from './entities/subscription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionEntity, BillingWebhookEventEntity]),
    ApiKeysModule,
    OauthModule,
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
