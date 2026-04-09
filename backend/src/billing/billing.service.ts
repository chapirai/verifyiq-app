import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionEntity } from './entities/subscription.entity';
import { UpsertSubscriptionDto } from './dto/upsert-subscription.dto';

const DEFAULT_PLANS = [
  { id: 'starter', code: 'starter', name: 'Starter', monthlyPriceCents: 19900, currency: 'EUR', isActive: true },
  { id: 'growth', code: 'growth', name: 'Growth', monthlyPriceCents: 69900, currency: 'EUR', isActive: true },
  { id: 'enterprise', code: 'enterprise', name: 'Enterprise', monthlyPriceCents: 0, currency: 'EUR', isActive: true },
];

@Injectable()
export class BillingService {
  private readonly mockCheckoutSessions = new Map<string, { tenantId: string; planCode: string }>();

  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepository: Repository<SubscriptionEntity>,
  ) {}

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

  async createCheckoutSession(tenantId: string, planCode: string): Promise<{ checkoutUrl: string; sessionId: string }> {
    const sessionId = `mock_cs_${randomUUID()}`;
    this.mockCheckoutSessions.set(sessionId, { tenantId, planCode });
    return {
      checkoutUrl: `https://payments.verifyiq.local/checkout/${sessionId}`,
      sessionId,
    };
  }

  async confirmPayment(tenantId: string, sessionId: string, planCode: string): Promise<{ success: boolean }> {
    const session = this.mockCheckoutSessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      return { success: false };
    }
    await this.upsertSubscription(tenantId, { planCode, status: 'active' });
    this.mockCheckoutSessions.delete(sessionId);
    return { success: true };
  }
}
