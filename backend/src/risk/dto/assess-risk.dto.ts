import { IsOptional, IsUUID } from 'class-validator';

export class AssessRiskDto {
  @IsUUID()
  partyId!: string;

  @IsOptional()
  @IsUUID()
  onboardingCaseId?: string;
}
