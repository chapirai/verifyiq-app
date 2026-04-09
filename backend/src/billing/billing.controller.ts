import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpsertSubscriptionDto } from './dto/upsert-subscription.dto';
import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  listPlans() {
    return { data: this.billingService.listPlans() };
  }

  @Get('subscription')
  async getSubscription(@CurrentUser() currentUser: JwtUser) {
    return { data: await this.billingService.getSubscriptionByTenant(currentUser.tenantId) };
  }

  @Post('subscription')
  async upsertSubscription(@CurrentUser() currentUser: JwtUser, @Body() dto: UpsertSubscriptionDto) {
    return { data: await this.billingService.upsertSubscription(currentUser.tenantId, dto) };
  }

  @Post('checkout-session')
  async createCheckoutSession(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: { planCode: string },
  ) {
    return { data: await this.billingService.createCheckoutSession(currentUser.tenantId, dto.planCode) };
  }

  @Post('payment/confirm')
  async confirmPayment(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: { sessionId: string; planCode: string },
  ) {
    return { data: await this.billingService.confirmPayment(currentUser.tenantId, dto.sessionId, dto.planCode) };
  }
}
