import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

const ORG_NR_REGEX = /^(\d{10}|\d{12})$/;

export class CreateBulkJobDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  rowsTotal?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20000)
  @Matches(ORG_NR_REGEX, { each: true, message: 'Each identifier must be 10 or 12 digits' })
  identifiers?: string[];
}
