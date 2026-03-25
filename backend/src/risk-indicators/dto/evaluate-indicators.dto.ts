import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class EvaluateIndicatorsDto {
  @IsString()
  @IsNotEmpty()
  organisationNumber!: string;

  @IsOptional()
  @IsObject()
  entityData?: Record<string, unknown>;
}
