import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, Max, Min } from 'class-validator';

export class CompareCompaniesDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  organisationNumbers!: string[];

  @IsOptional()
  @Min(2)
  @Max(6)
  years?: number;
}

