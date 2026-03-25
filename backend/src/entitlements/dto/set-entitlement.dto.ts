import { IsBoolean, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class SetEntitlementDto {
  @IsString()
  @IsNotEmpty()
  datasetFamily!: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  monthlyQuota?: number;

  @IsString()
  @IsOptional()
  planTier?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
