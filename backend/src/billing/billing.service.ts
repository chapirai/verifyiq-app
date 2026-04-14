import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe = require('stripe');
import { ApiKeysService } from '../api-keys/api-keys.service';
import { OauthService } from '../oauth/oauth.service';
import { BillingWebhookEventEntity } from './entities/billing-webhook-event.entity';
import { SubscriptionEntity } from './entities/subscription.entity';
import { UpsertSubscriptionDto } from './dto/upsert-subscription.dto';

const DEFAULT_PLANS = [
  { id: 'free', code: 'free', name: 'Free', monthlyPriceCents: 0, currency: 'SEK', isActive: true },
  { id: 'basic', code: 'basic', name: 'Basic', monthlyPriceCents: 4900, currency: 'SEK', isActive: true },
  { id: 'pro', code: 'pro', name: 'Pro', monthlyPriceCents: 99900, currency: 'SEK', isActive: true },
];

@Injectable()
export class BillingService {
  private readonly stripe: InstanceType<typeof Stripe> | null;
  private readonly appBaseUrl: string;
  private readonly dashboardBaseUrl: string;
  private readonly stripeWebhookSecret: string;

  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepository: Repository<SubscriptionEntity>,
    @InjectRepository(BillingWebhookEventEntity)
    private readonly webhookRepo: Repository<BillingWebhookEventEntity>,
    private readonly config: ConfigService,
    private readonly apiKeysService: ApiKeysService,
    private readonly oauthService: OauthService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = key ? new Stripe(key) : null;
    this.stripeWebhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    this.appBaseUrl = this.config.get<string>('APP_BASE_URL') ?? 'http://localhost:3000';
    this.dashboardBaseUrl = this.config.get<string>('DASHBOARD_BASE_URL') ?? this.appBaseUrl;
  }

  listPlans() {
    return DEFAULT_PLANS;
  }

  async getSubscriptionByTenant(tenantId: string): Promise<SubscriptionEntity | null> {
    return this.subscriptionRepository.findOne({ where: { tenantId } });
  }

  async upsertSubscription(tenantId: string, dto: UpsertSubscriptionDto): Promise<SubscriptionEntity> {
    const existing = await this.subscriptionRepository.findOne({ where: { tenantId } });
    if (existing) {
      existing.planCode = dto.planCode;
      existing.status = dto.status ?? existing.status;
      return this.subscriptionRepository.save(existing);
    }
    const subscription = this.subscriptionRepository.create({
      tenantId,
      planCode: dto.planCode,
      status: dto.status ?? 'trialing',
      currentPeriodStart: new Date(),
      currentPeriodEnd: null,
      canceledAt: null,
      providerCustomerId: null,
      providerSubscriptionId: null,
    });
    return this.subscriptionRepository.save(subscription);
  }

  private priceIdForPlan(planCode: string): string | null {
    const map: Record<string, string | undefined> = {
      free: this.config.get<string>('STRIPE_PRICE_ID_FREE'),
      basic: this.config.get<string>('STRIPE_PRICE_ID_BASIC'),
      pro: this.config.get<string>('STRIPE_PRICE_ID_PRO'),
    };
    return map[planCode] ?? null;
  }

  async createCheckoutSession(
    tenantId: string,
    userEmail: string | undefined,
    planCode: string,
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    const priceId = this.priceIdForPlan(planCode);
    if (!['free', 'basic', 'pro'].includes(planCode)) {
      throw new BadRequestException('invalid_plan_code');
    }
    if (this.config.get<string>('NODE_ENV') === 'production' && (!this.stripe || !priceId)) {
      throw new InternalServerErrorException('stripe_not_configured');
    }
    if (!this.stripe || !priceId) {
      return {
        checkoutUrl: `${this.dashboardBaseUrl}/billing?mock=1&plan=${encodeURIComponent(planCode)}`,
        sessionId: `mock_${tenantId}_${Date.now()}`,
      };
    }
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: userEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.dashboardBaseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.dashboardBaseUrl}/billing/cancel`,
      metadata: {
        tenantId,
        planCode,
      },
      subscription_data: {
        metadata: { tenantId, planCode },
      },
    });
    return { checkoutUrl: session.url ?? '', sessionId: session.id };
  }

  async confirmPayment(tenantId: string, sessionId: string, planCode: string): Promise<{ success: boolean }> {
    if (!this.stripe) {
      await this.activatePlanWithProvisioning(tenantId, planCode, null, null);
      return { success: true };
    }
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid' && session.status !== 'complete') return { success: false };
    const customerId = typeof session.customer === 'string' ? session.customer : null;
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : null;
    await this.activatePlanWithProvisioning(tenantId, planCode, customerId, subscriptionId);
    return { success: true };
  }

  async createPortalSession(tenantId: string): Promise<{ url: string }> {
    const sub = await this.getSubscriptionByTenant(tenantId);
    if (!sub?.providerCustomerId || !this.stripe) {
      return { url: `${this.dashboardBaseUrl}/billing` };
    }
    const portal = await this.stripe.billingPortal.sessions.create({
      customer: sub.providerCustomerId,
      return_url: `${this.dashboardBaseUrl}/billing`,
    });
    return { url: portal.url };
  }

  async handleStripeWebhook(payload: Buffer | string, signature: string | undefined) {
    if (!this.stripe) return { ok: true, skipped: true };
    if (this.config.get<string>('NODE_ENV') === 'production' && !this.stripeWebhookSecret) {
      throw new InternalServerErrorException('stripe_webhook_secret_missing');
    }
    let event: any;
    if (this.stripeWebhookSecret && signature) {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.stripeWebhookSecret);
    } else {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new BadRequestException('stripe_signature_required');
      }
      const data = typeof payload === 'string' ? JSON.parse(payload) : JSON.parse(payload.toString('utf8'));
      event = data;
    }

    const existing = await this.webhookRepo.findOne({
      where: { provider: 'stripe', eventId: event.id },
    });
    if (existing) return { ok: true, duplicate: true };

    const row = this.webhookRepo.create({
      provider: 'stripe',
      eventId: event.id,
      eventType: event.type,
      status: 'processed',
      payload: event as unknown as Record<string, unknown>,
      errorMessage: null,
      processedAt: new Date(),
    });

    try {
      if (event.type === 'checkout.session.completed') {
        const s = event.data.object as any;
        const tenantId = s.metadata?.tenantId;
        const planCode = s.metadata?.planCode ?? 'basic';
        if (tenantId) {
          const customerId = typeof s.customer === 'string' ? s.customer : null;
          const subscriptionId = typeof s.subscription === 'string' ? s.subscription : null;
          await this.activatePlanWithProvisioning(tenantId, planCode, customerId, subscriptionId);
        }
      }
      if (event.type === 'invoice.payment_succeeded') {
        const inv = event.data.object as any;
        const subscriptionId =
          typeof inv.subscription === 'string' ? inv.subscription : null;
        if (subscriptionId) {
          const sub = await this.subscriptionRepository.findOne({
            where: { providerSubscriptionId: subscriptionId },
          });
          if (sub) {
            sub.status = 'active';
            await this.subscriptionRepository.save(sub);
          }
        }
      }
      if (event.type === 'customer.subscription.deleted') {
        const subDeleted = event.data.object as any;
        const sid = subDeleted.id;
        const sub = await this.subscriptionRepository.findOne({
          where: { providerSubscriptionId: sid },
        });
        if (sub) {
          sub.status = 'canceled';
          sub.canceledAt = new Date();
          await this.subscriptionRepository.save(sub);
        }
      }
    } catch (e) {
      row.status = 'failed';
      row.errorMessage = e instanceof Error ? e.message : String(e);
    }

    await this.webhookRepo.save(row);
    return { ok: row.status !== 'failed' };
  }

  private async activatePlanWithProvisioning(
    tenantId: string,
    planCode: string,
    providerCustomerId: string | null,
    providerSubscriptionId: string | null,
  ): Promise<SubscriptionEntity> {
    const subscription = await this.upsertSubscription(tenantId, {
      planCode,
      status: planCode === 'free' ? 'trialing' : 'active',
    });
    subscription.providerCustomerId = providerCustomerId ?? subscription.providerCustomerId ?? null;
    subscription.providerSubscriptionId =
      providerSubscriptionId ?? subscription.providerSubscriptionId ?? null;
    subscription.currentPeriodStart = new Date();
    await this.subscriptionRepository.save(subscription);

    await this.apiKeysService.ensureSandboxKey(tenantId);
    if (planCode !== 'free') {
      const existingLive = await this.apiKeysService.listByTenantAndEnvironment(tenantId, 'live');
      if (!existingLive.length) {
        await this.apiKeysService.createKey(tenantId, 'Live API key', 'live');
      }
      await this.oauthService.ensureSandboxClient(tenantId);
    } else {
      await this.oauthService.ensureSandboxClient(tenantId);
    }
    return subscription;
  }
}
