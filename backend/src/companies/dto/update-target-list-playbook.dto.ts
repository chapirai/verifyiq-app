import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTargetListPlaybookDto {
  @IsOptional()
  @IsEnum(['founder_exit', 'distressed', 'roll_up'])
  dealMode?: 'founder_exit' | 'distressed' | 'roll_up';

  @IsOptional()
  @IsString()
  @MaxLength(400)
  thesis?: string;
}

