import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateBeneficialOwnerDto {
  @IsString()
  organisationNumber!: string;

  @IsString()
  personName!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  personnummer?: string;

  @IsOptional()
  @IsNumber()
  ownershipPercentage?: number;

  @IsOptional()
  @IsNumber()
  controlPercentage?: number;

  @IsOptional()
  @IsString()
  ownershipType?: string;

  @IsOptional()
  @IsBoolean()
  isAlternativeBeneficialOwner?: boolean;

  @IsOptional()
  @IsString()
  alternativeReason?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  sourceData?: Record<string, unknown>;
}
