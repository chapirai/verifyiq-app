import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateCreditDecisionTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  targetEntityType?: string;

  @IsOptional()
  @IsArray()
  rules?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsObject()
  approveConditions?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  rejectConditions?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  manualReviewConditions?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
