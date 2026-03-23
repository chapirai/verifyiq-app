import { Body, Controller, Get, Post } from '@nestjs/common';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('generate')
  generate(@Body() dto: GenerateReportDto) {
    return this.reportsService.generate(dto);
  }

  @Get()
  listReports() {
    return this.reportsService.listReports();
  }
}
