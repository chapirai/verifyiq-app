import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewScreeningMatchDto {
  @IsIn(['confirmed', 'dismissed', 'needs_follow_up'])
  matchStatus!: 'confirmed' | 'dismissed' | 'needs_follow_up';

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
