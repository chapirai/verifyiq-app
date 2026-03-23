import { IsObject, IsString, IsUUID } from 'class-validator';

export class DeliverWebhookDto {
  @IsUUID()
  endpointId!: string;

  @IsString()
  eventName!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
