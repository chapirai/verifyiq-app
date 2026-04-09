import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertSubscriptionDto {
  @IsString()
  @MaxLength(64)
  planCode!: string;

  @IsOptional()
  @IsString()
  @IsIn(['trialing', 'active', 'past_due', 'canceled'])
  status?: string;
}
