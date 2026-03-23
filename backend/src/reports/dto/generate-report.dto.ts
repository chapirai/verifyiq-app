import { IsObject, IsString } from 'class-validator';

export class GenerateReportDto {
  @IsString()
  reportType!: string;

  @IsObject()
  filters!: Record<string, unknown>;
}
