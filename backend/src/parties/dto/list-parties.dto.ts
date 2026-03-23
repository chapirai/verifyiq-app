import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListPartiesDto {
  @IsOptional()
  @IsIn(['individual', 'legal_entity'])
  type?: 'individual' | 'legal_entity';

  @IsOptional()
  @IsString()
  q?: string;
}
