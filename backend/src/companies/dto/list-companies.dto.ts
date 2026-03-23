import { IsOptional, IsString } from 'class-validator';

export class ListCompaniesDto {
  @IsOptional()
  @IsString()
  q?: string;
}
