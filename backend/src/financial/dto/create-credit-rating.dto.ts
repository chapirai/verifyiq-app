import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateCreditRatingDto {
  @IsString()
  @IsNotEmpty()
  organisationNumber!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  ratingProvider?: string;

  @IsOptional()
  @IsString()
  rating?: string;

  @IsOptional()
  @IsInt()
  ratingScore?: number;

  @IsOptional()
  @IsString()
  ratingDescription?: string;

  @IsOptional()
  @IsString()
  riskClass?: string;

  @IsOptional()
  @IsDateString()
  ratedAt?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @IsOptional()
  @IsObject()
  sourceData?: Record<string, unknown>;
}
