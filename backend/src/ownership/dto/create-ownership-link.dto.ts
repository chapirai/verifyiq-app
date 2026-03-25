import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateOwnershipLinkDto {
  @IsEnum(['person', 'company'])
  ownerType!: 'person' | 'company';

  @IsString()
  ownerName!: string;

  @IsString()
  ownedOrganisationNumber!: string;

  @IsString()
  ownedCompanyName!: string;

  @IsOptional()
  @IsUUID()
  ownerPersonId?: string;

  @IsOptional()
  @IsUUID()
  ownerCompanyId?: string;

  @IsOptional()
  @IsString()
  ownerOrganisationNumber?: string;

  @IsOptional()
  @IsString()
  ownerPersonnummer?: string;

  @IsOptional()
  @IsUUID()
  ownedCompanyId?: string;

  @IsOptional()
  @IsNumber()
  ownershipPercentage?: number;

  @IsOptional()
  @IsString()
  ownershipType?: string;

  @IsOptional()
  @IsString()
  ownershipClass?: string;

  @IsOptional()
  @IsNumber()
  controlPercentage?: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @IsOptional()
  sourceData?: Record<string, unknown>;
}
