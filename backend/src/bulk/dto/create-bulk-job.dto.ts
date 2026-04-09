import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';

export class CreateBulkJobDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  rowsTotal!: number;
}
