import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpsertPersonEnrichmentDto } from './dto/upsert-person-enrichment.dto';
import { PersonEnrichmentService } from './person-enrichment.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Controller('person-enrichment')
@UseGuards(JwtAuthGuard)
export class PersonEnrichmentController {
  constructor(private readonly personEnrichmentService: PersonEnrichmentService) {}

  @Get()
  listPersonEnrichments(@Query('limit') limit?: string) {
    return this.personEnrichmentService.listPersonEnrichments(TENANT_ID, limit ? parseInt(limit, 10) : 50);
  }

  @Get(':personnummer')
  getPersonEnrichment(@Param('personnummer') personnummer: string) {
    return this.personEnrichmentService.getPersonEnrichment(TENANT_ID, personnummer);
  }

  @Put(':personnummer')
  upsertPersonEnrichment(
    @Param('personnummer') personnummer: string,
    @Body() dto: UpsertPersonEnrichmentDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.personEnrichmentService.upsertPersonEnrichment(TENANT_ID, actorId, personnummer, dto);
  }
}
