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

  @IsOptional()
  @IsString()
  subjectType?: string;

  @IsOptional()
  @IsString()
  organisationNumber?: string;

  @IsOptional()
  @IsString()
  personnummer?: string;

  @IsOptional()
  @IsArray()
  datasetFamilies?: string[];

  @IsOptional()
  alertConfig?: Record<string, unknown>;
}
