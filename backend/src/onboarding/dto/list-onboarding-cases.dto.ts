import { IsOptional, IsString } from 'class-validator';

export class ListOnboardingCasesDto {
  @IsOptional()
  @IsString()
  status?: string;
}
