import { IsIn, IsOptional, IsString } from 'class-validator';

export class DecideOnboardingCaseDto {
  @IsIn(['approve', 'reject', 'request_info'])
  decision!: 'approve' | 'reject' | 'request_info';

  @IsOptional()
  @IsString()
  reason?: string;
}
