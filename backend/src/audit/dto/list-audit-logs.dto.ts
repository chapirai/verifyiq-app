import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListAuditLogsDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
