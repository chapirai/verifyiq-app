import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

export class CompanyLookupDto {
  @IsString()
  identitetsbeteckning!: string;

  /**
   * Schema: namnskyddslopnummer — sequence number for multi-company registrations.
   * Defined as a string in OrganisationRequest (e.g., "1" or "001" with optional leading zeros).
   */
  @IsOptional()
  @IsString()
  namnskyddslopnummer?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  organisationInformationsmangd?: string[];

  /** Schema: tidpunkt — timestamp for historical data lookup (ISO 8601, no milliseconds). */
  @IsOptional()
  @IsString()
  tidpunkt?: string;
}
