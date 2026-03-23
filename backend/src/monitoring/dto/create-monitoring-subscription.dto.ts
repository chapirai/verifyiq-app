import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMonitoringSubscriptionDto {
  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsArray()
  @IsString({ each: true })
  eventTypes!: string[];
}
