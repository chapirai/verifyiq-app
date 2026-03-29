import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ChangeType } from '../entities/company-change-event.entity';
import { ChangeEventQueryService } from '../services/change-event-query.service';

// ── Permission helpers ────────────────────────────────────────────────────────

/**
 * Roles authorised to access company change events.
 * P02-T08: admin, audit, and evidence roles.
 */
const CHANGE_EVENT_READ_ROLES = ['admin', 'audit', 'evidence', 'compliance'] as const;

function assertChangeEventAccess(req: any): void {
  const role = (req.user?.role ?? req.user?.roles?.[0]) as string | undefined;
  if (!role || !(CHANGE_EVENT_READ_ROLES as readonly string[]).includes(role)) {
    throw new ForbiddenException(
      'Change event access is restricted to admin, audit, evidence, and compliance roles.',
    );
  }
}

// ── Controller ────────────────────────────────────────────────────────────────

/**
 * P02-T08: Read-only API for company change events.
 *
 * All endpoints are permission-gated to admin / audit / evidence / compliance
 * roles.  All queries are tenant-scoped via the authenticated JWT.
 */
@Controller('change-events')
@UseGuards(JwtAuthGuard)
export class ChangeEventController {
  constructor(private readonly changeEventQueryService: ChangeEventQueryService) {}

  /**
   * GET /change-events/:id
   * Retrieve a single change event by ID (tenant-scoped).
   */
  @Get(':id')
  async getById(@Param('id') id: string, @Req() req: any) {
    assertChangeEventAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? 'demo-tenant';
    const record = await this.changeEventQueryService.getById(tenantId, id);
    if (!record) {
      throw new NotFoundException(`Change event '${id}' not found.`);
    }
    return record;
  }

  /**
   * GET /change-events/by-org/:orgNumber
   * Return all change events for a company, with optional filters:
   *   - attributeName: exact attribute name match
   *   - changeType:    ADDED | MODIFIED | REMOVED | UNCHANGED | UNKNOWN
   *   - fromDate:      ISO 8601 start date (inclusive)
   *   - toDate:        ISO 8601 end date (inclusive)
   *   - limit:         max records (default 50, max 200)
   */
  @Get('by-org/:orgNumber')
  async findByOrgNumber(
    @Param('orgNumber') orgNumber: string,
    @Query('attributeName') attributeName: string | undefined,
    @Query('changeType') changeType: string | undefined,
    @Query('fromDate') fromDate: string | undefined,
    @Query('toDate') toDate: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    assertChangeEventAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? 'demo-tenant';
    return this.changeEventQueryService.findByOrgNumber(tenantId, orgNumber, {
      attributeName,
      changeType: changeType as ChangeType | undefined,
      fromDate,
      toDate,
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 50,
    });
  }

  /**
   * GET /change-events/by-snapshot/:snapshotId
   * Return all change events produced for a given after-snapshot.
   */
  @Get('by-snapshot/:snapshotId')
  async findBySnapshot(
    @Param('snapshotId') snapshotId: string,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    assertChangeEventAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? 'demo-tenant';
    const take = limit ? Math.min(parseInt(limit, 10), 200) : 200;
    return this.changeEventQueryService.findBySnapshotAfter(tenantId, snapshotId, take);
  }

  /**
   * GET /change-events/by-attribute/:attributeName
   * Return all change events for a specific attribute across all companies,
   * with optional date range and limit filters.
   */
  @Get('by-attribute/:attributeName')
  async findByAttribute(
    @Param('attributeName') attributeName: string,
    @Query('fromDate') fromDate: string | undefined,
    @Query('toDate') toDate: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    assertChangeEventAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? 'demo-tenant';
    return this.changeEventQueryService.findByAttribute(tenantId, attributeName, {
      fromDate,
      toDate,
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 50,
    });
  }

  /**
   * GET /change-events/by-change-type/:changeType
   * Return all change events of a given type, with optional date range and limit.
   */
  @Get('by-change-type/:changeType')
  async findByChangeType(
    @Param('changeType') changeType: string,
    @Query('fromDate') fromDate: string | undefined,
    @Query('toDate') toDate: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    assertChangeEventAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? 'demo-tenant';
    return this.changeEventQueryService.findByChangeType(tenantId, changeType as ChangeType, {
      fromDate,
      toDate,
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 50,
    });
  }

  /**
   * GET /change-events/summary/:orgNumber
   * Return a per-change-type count summary for a company.
   */
  @Get('summary/:orgNumber')
  async getChangeTypeSummary(
    @Param('orgNumber') orgNumber: string,
    @Query('fromDate') fromDate: string | undefined,
    @Query('toDate') toDate: string | undefined,
    @Req() req: any,
  ) {
    assertChangeEventAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? 'demo-tenant';
    return this.changeEventQueryService.getChangeTypeSummary(tenantId, orgNumber, {
      fromDate,
      toDate,
    });
  }
}
