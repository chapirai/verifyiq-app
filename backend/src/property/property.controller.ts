import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RecordPropertyOwnershipDto } from './dto/record-property-ownership.dto';
import { PropertyService } from './property.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

@Controller('property')
@UseGuards(JwtAuthGuard)
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Post('ownerships')
  recordPropertyOwnership(@Body() dto: RecordPropertyOwnershipDto, @CurrentUser('id') actorId: string) {
    return this.propertyService.recordPropertyOwnership(TENANT_ID, actorId, dto);
  }

  @Get('ownerships/company/:orgNr')
  listByCompany(@Param('orgNr') orgNr: string) {
    return this.propertyService.listByCompany(TENANT_ID, orgNr);
  }

  @Get('ownerships/person/:personnummer')
  listByPerson(@Param('personnummer') personnummer: string) {
    return this.propertyService.listByPerson(TENANT_ID, personnummer);
  }

  @Get('summary/:ownerType/:ownerId')
  getPropertySummary(@Param('ownerType') ownerType: string, @Param('ownerId') ownerId: string) {
    return this.propertyService.getPropertySummary(TENANT_ID, ownerType, ownerId);
  }
}
