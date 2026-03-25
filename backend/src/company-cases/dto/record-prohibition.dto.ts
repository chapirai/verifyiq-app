import { IsArray, IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class RecordProhibitionDto {
  @IsString()
  @IsNotEmpty()
  personnummer!: string;

  @IsOptional()
  @IsString()
  personName?: string;

  @IsOptional()
  @IsString()
  prohibitionType?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  sourceAuthority?: string;

  @IsOptional()
  @IsArray()
  linkedCompanies?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
