import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { CreateOnboardingCaseDto } from './dto/create-onboarding-case.dto';
import { DecideOnboardingCaseDto } from './dto/decide-onboarding-case.dto';
import { ListOnboardingCasesDto } from './dto/list-onboarding-cases.dto';
import { TransitionOnboardingCaseDto } from './dto/transition-onboarding-case.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding/cases')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateOnboardingCaseDto) {
    return this.onboardingService.create(req.user.tenantId, req.user.sub, dto);
  }

  @Get()
  findAll(@Req() req: any, @Query() query: ListOnboardingCasesDto) {
    return this.onboardingService.findAll(req.user.tenantId, query);
  }

  @Post(':id/transition')
  transition(@Req() req: any, @Param('id') id: string, @Body() dto: TransitionOnboardingCaseDto) {
    return this.onboardingService.transition(req.user.tenantId, req.user.sub, id, dto);
  }

  @Post(':id/decision')
  decide(@Req() req: any, @Param('id') id: string, @Body() dto: DecideOnboardingCaseDto) {
    return this.onboardingService.decide(req.user.tenantId, req.user.sub, id, dto);
  }

  @Get(':id/timeline')
  timeline(@Req() req: any, @Param('id') id: string) {
    return this.onboardingService.getTimeline(req.user.tenantId, id);
  }
}
