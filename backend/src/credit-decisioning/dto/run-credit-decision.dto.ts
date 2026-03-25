import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class RunCreditDecisionDto {
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsString()
  organisationNumber?: string;

  @IsOptional()
  @IsString()
  personnummer?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsObject()
  inputData?: Record<string, unknown>;
}
