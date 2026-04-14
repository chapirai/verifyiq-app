import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpsertSubscriptionDto } from './dto/upsert-subscription.dto';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @UseGuards(JwtAuthGuard)
  listPlans() {
    return { data: this.billingService.listPlans() };
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  async getSubscription(@CurrentUser() currentUser: JwtUser) {
    return { data: await this.billingService.getSubscriptionByTenant(currentUser.tenantId) };
  }

  @Post('subscription')
  @UseGuards(JwtAuthGuard)
  async upsertSubscription(@CurrentUser() currentUser: JwtUser, @Body() dto: UpsertSubscriptionDto) {
    return { data: await this.billingService.upsertSubscription(currentUser.tenantId, dto) };
  }

  @Post('checkout-session')
  @UseGuards(JwtAuthGuard)
  async createCheckoutSession(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: { planCode: string },
  ) {
    return {
      data: await this.billingService.createCheckoutSession(
        currentUser.tenantId,
        currentUser.email,
        dto.planCode,
      ),
    };
  }

  @Post('portal-session')
  @UseGuards(JwtAuthGuard)
  async createPortalSession(@CurrentUser() currentUser: JwtUser) {
    return { data: await this.billingService.createPortalSession(currentUser.tenantId) };
  }

  @Post('payment/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmPayment(
    @CurrentUser() currentUser: JwtUser,
    @Body() dto: { sessionId: string; planCode: string },
  ) {
    return { data: await this.billingService.confirmPayment(currentUser.tenantId, dto.sessionId, dto.planCode) };
  }

  @Post('webhook')
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature?: string,
  ) {
    const payload = req.rawBody ?? JSON.stringify(req.body ?? {});
    return this.billingService.handleStripeWebhook(payload, signature);
  }
}
