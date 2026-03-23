import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { DeliverWebhookDto } from './dto/deliver-webhook.dto';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('endpoints')
  createEndpoint(@Body() dto: CreateWebhookEndpointDto) {
    return this.webhooksService.createEndpoint(dto);
  }

  @Get('endpoints')
  listEndpoints() {
    return this.webhooksService.listEndpoints();
  }

  @Post('deliver')
  deliver(@Body() dto: DeliverWebhookDto) {
    return this.webhooksService.deliver(dto);
  }

  @Get('deliveries')
  listDeliveries() {
    return this.webhooksService.listDeliveries();
  }
}
