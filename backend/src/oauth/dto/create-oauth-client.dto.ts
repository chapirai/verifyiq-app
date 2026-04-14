import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateOauthClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsIn(['live', 'sandbox'])
  environment?: 'live' | 'sandbox';
}
