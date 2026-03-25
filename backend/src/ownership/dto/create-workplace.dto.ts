import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateWorkplaceDto {
  @IsString()
  organisationNumber!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  cfarNumber?: string;

  @IsOptional()
  @IsString()
  workplaceName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  postalAddress?: Record<string, unknown>;

  @IsOptional()
  deliveryAddress?: Record<string, unknown>;

  @IsOptional()
  coordinates?: Record<string, unknown>;

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
  @IsString()
  industryCode?: string;

  @IsOptional()
  @IsString()
  industryDescription?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  sourceData?: Record<string, unknown>;
}
