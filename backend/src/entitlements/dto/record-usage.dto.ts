import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class RecordUsageDto {
  @IsString()
  @IsNotEmpty()
  datasetFamily!: string;

  @IsString()
  @IsNotEmpty()
  action!: string;

  @IsString()
  @IsOptional()
  resourceId?: string;

  @IsString()
  @IsOptional()
  resourceType?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  billingUnits?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
