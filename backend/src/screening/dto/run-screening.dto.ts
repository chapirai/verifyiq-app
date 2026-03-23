import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RunScreeningDto {
  @IsUUID()
  partyId!: string;

  @IsOptional()
  @IsString()
  provider?: string;
}
