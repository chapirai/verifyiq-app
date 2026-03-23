import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ReviewScreeningMatchDto } from './dto/review-screening-match.dto';
import { RunScreeningDto } from './dto/run-screening.dto';
import { ScreeningService } from './screening.service';

@Controller('screening')
export class ScreeningController {
  constructor(private readonly screeningService: ScreeningService) {}

  @Post('run')
  run(@Req() req: any, @Body() dto: RunScreeningDto) {
    return this.screeningService.run(req.user.tenantId, req.user.sub, dto);
  }

  @Get('queue')
  queue(@Req() req: any) {
    return this.screeningService.listQueue(req.user.tenantId);
  }

  @Post('matches/:id/review')
  review(@Req() req: any, @Param('id') id: string, @Body() dto: ReviewScreeningMatchDto) {
    return this.screeningService.reviewMatch(req.user.tenantId, req.user.sub, id, dto);
  }
}
