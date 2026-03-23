import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { createHmac, createHash } from 'crypto';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { DeliverWebhookDto } from './dto/deliver-webhook.dto';
import { WebhookDeliveryEntity } from './webhook-delivery.entity';
import { WebhookEndpointEntity } from './webhook-endpoint.entity';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookEndpointEntity)
    private readonly endpointsRepo: Repository<WebhookEndpointEntity>,
    @InjectRepository(WebhookDeliveryEntity)
    private readonly deliveriesRepo: Repository<WebhookDeliveryEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createEndpoint(dto: CreateWebhookEndpointDto, actorUserId?: string) {
    const endpoint = this.endpointsRepo.create({
      tenantId: '00000000-0000-0000-0000-000000000001',
      name: dto.name,
      targetUrl: dto.targetUrl,
      secretHash: createHash('sha256').update(dto.secret).digest('hex'),
      subscribedEvents: dto.subscribedEvents,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.endpointsRepo.save(endpoint);
    await this.auditService.log({ action: 'webhook.endpoint.created', actorUserId, entityType: 'webhook_endpoint', entityId: saved.id, payload: { ...dto, secret: '[redacted]' } });
    return saved;
  }

  listEndpoints() {
    return this.endpointsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async deliver(dto: DeliverWebhookDto) {
    const endpoint = await this.endpointsRepo.findOne({ where: { id: dto.endpointId, isActive: true } });
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');

    const payloadText = JSON.stringify(dto.payload);
    const signature = createHmac('sha256', endpoint.secretHash).update(payloadText).digest('hex');

    const delivery = this.deliveriesRepo.create({
      tenantId: endpoint.tenantId,
      webhookEndpointId: endpoint.id,
      eventName: dto.eventName,
      status: 'pending',
      requestBody: dto.payload,
    });
    const saved = await this.deliveriesRepo.save(delivery);

    try {
      const response = await axios.post(endpoint.targetUrl, dto.payload, {
        timeout: 5000,
        headers: {
          'content-type': 'application/json',
          'x-verifyiq-event': dto.eventName,
          'x-verifyiq-signature': signature,
          'x-verifyiq-delivery-id': saved.id,
        },
        validateStatus: () => true,
      });

      saved.responseStatus = response.status;
      saved.responseBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      saved.status = response.status >= 200 && response.status < 300 ? 'delivered' : 'retry_scheduled';
      saved.deliveredAt = saved.status === 'delivered' ? new Date() : null;
      saved.nextRetryAt = saved.status === 'delivered' ? null : new Date(Date.now() + 5 * 60 * 1000);
      saved.attemptNumber = 1;
      return this.deliveriesRepo.save(saved);
    } catch (error: any) {
      saved.status = 'retry_scheduled';
      saved.responseBody = error?.message ?? 'Request failed';
      saved.nextRetryAt = new Date(Date.now() + 5 * 60 * 1000);
      return this.deliveriesRepo.save(saved);
    }
  }

  listDeliveries() {
    return this.deliveriesRepo.find({ order: { createdAt: 'DESC' } });
  }
}
