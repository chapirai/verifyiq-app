import { IsEmail, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class CreatePartyDto {
  @IsIn(['individual', 'legal_entity'])
  type!: 'individual' | 'legal_entity';

  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  displayName!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  personalNumber?: string;

  @IsOptional()
  @IsString()
  organisationNumber?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  externalRef?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
