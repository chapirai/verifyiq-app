import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RequestBulkEnrichmentDto {
  @IsString()
  organisationNumber!: string;

  @IsIn(['company_opened', 'compare', 'manual', 'api_request', 'ownership', 'officers', 'documents', 'financial'])
  reason!:
    | 'company_opened'
    | 'compare'
    | 'manual'
    | 'api_request'
    | 'ownership'
    | 'officers'
    | 'documents'
    | 'financial';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  priority?: number;
}

