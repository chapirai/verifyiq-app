import { IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class RecordPropertyOwnershipDto {
  @IsString()
  ownerType!: string;

  @IsString()
  ownerName!: string;

  @IsOptional()
  @IsString()
  ownerOrganisationNumber?: string;

  @IsOptional()
  @IsString()
  ownerPersonnummer?: string;

  @IsOptional()
  @IsString()
  propertyDesignation?: string;

  @IsOptional()
  @IsString()
  propertyType?: string;

  @IsOptional()
  @IsString()
  municipalityCode?: string;

  @IsOptional()
  @IsString()
  municipalityName?: string;

  @IsOptional()
  @IsString()
  countyCode?: string;

  @IsOptional()
  @IsString()
  countyName?: string;

  @IsOptional()
  @IsNumber()
  taxValue?: number;

  @IsOptional()
  @IsNumber()
  taxValueYear?: number;

  @IsOptional()
  @IsNumber()
  ownershipShare?: number;

  @IsOptional()
  @IsString()
  acquisitionDate?: string;

  @IsOptional()
  @IsObject()
  address?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  sourceData?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}
