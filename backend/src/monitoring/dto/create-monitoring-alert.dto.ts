import { IsIn, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMonitoringAlertDto {
  @IsUUID()
  subscriptionId!: string;

  @IsString()
  alertType!: string;

  @IsIn(['low', 'medium', 'high', 'critical'])
  severity!: 'low' | 'medium' | 'high' | 'critical';

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
