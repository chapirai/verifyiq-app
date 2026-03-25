import { IsArray, IsBoolean, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpsertPersonEnrichmentDto {
  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsBoolean()
  isDeceased?: boolean;

  @IsOptional()
  @IsString()
  deceasedDate?: string;

  @IsOptional()
  @IsObject()
  officialAddress?: Record<string, unknown>;

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
  @IsArray()
  boardAssignments?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsArray()
  beneficialOwnerLinks?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsObject()
  businessProhibition?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  sanctionsStatus?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  pepStatus?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  dataPermissions?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  enrichedAt?: string;
}
