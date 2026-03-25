import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateRiskIndicatorConfigDto {
  @IsString()
  name!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  datasetFamily?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsObject()
  threshold?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  conditionLogic?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
