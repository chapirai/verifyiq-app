import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

export class CompanyLookupDto {
  @IsString()
  identitetsbeteckning!: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  organisationInformationsmangd?: string[];
}
