import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDocumentDto {
  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsString()
  fileName!: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}
