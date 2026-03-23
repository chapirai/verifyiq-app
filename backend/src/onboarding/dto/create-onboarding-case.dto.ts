import { IsOptional, IsUUID } from 'class-validator';

export class CreateOnboardingCaseDto {
  @IsUUID()
  partyId!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;
}
