import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class AddTargetListItemsBulkDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  organisationNumbers!: string[];

  @IsOptional()
  @IsEnum(['founder_exit', 'distressed', 'roll_up'])
  dealMode?: 'founder_exit' | 'distressed' | 'roll_up';
}
