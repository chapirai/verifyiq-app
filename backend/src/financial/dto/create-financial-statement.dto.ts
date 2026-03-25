import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateFinancialStatementDto {
  @IsString()
  @IsNotEmpty()
  organisationNumber!: string;

  @IsString()
  @IsNotEmpty()
  fiscalYear!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsDateString()
  fiscalYearStart?: string;

  @IsOptional()
  @IsDateString()
  fiscalYearEnd?: string;

  @IsOptional()
  @IsString()
  reportType?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  revenue?: number;

  @IsOptional()
  @IsNumber()
  operatingResult?: number;

  @IsOptional()
  @IsNumber()
  netResult?: number;

  @IsOptional()
  @IsNumber()
  totalAssets?: number;

  @IsOptional()
  @IsNumber()
  totalEquity?: number;

  @IsOptional()
  @IsNumber()
  totalLiabilities?: number;

  @IsOptional()
  @IsNumber()
  cashAndEquivalents?: number;

  @IsOptional()
  @IsInt()
  numberOfEmployees?: number;

  @IsOptional()
  @IsObject()
  ratios?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  rawData?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsUUID()
  documentId?: string;
}
