import { IsOptional, IsString } from 'class-validator';

export class TransitionOnboardingCaseDto {
  @IsString()
  toState!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
