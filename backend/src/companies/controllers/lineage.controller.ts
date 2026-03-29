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
import { TriggerType } from '../entities/lineage-metadata.entity';
import { LineageQueryService } from '../services/lineage-query.service';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ── Permission helpers ────────────────────────────────────────────────────────

/**
 * Roles authorised to access lineage metadata.
 * P02-T06: admin, audit, and evidence roles.
 */
const LINEAGE_READ_ROLES = ['admin', 'audit', 'evidence', 'compliance'] as const;

function assertLineageAccess(req: any): void {
  const role = (req.user?.role ?? req.user?.roles?.[0]) as string | undefined;
  if (!role || !(LINEAGE_READ_ROLES as readonly string[]).includes(role)) {
    throw new ForbiddenException(
      'Lineage metadata access is restricted to admin, audit, evidence, and compliance roles.',
    );
  }
}

// ── Controller ────────────────────────────────────────────────────────────────

/**
 * P02-T06: Read-only API for lineage metadata.
 *
 * All endpoints are permission-gated to admin / audit / evidence / compliance
 * roles.  All queries are tenant-scoped via the authenticated JWT.
 */
@Controller('lineage')
@UseGuards(JwtAuthGuard)
export class LineageController {
  constructor(private readonly lineageQueryService: LineageQueryService) {}

  /**
   * GET /lineage/:id
   * Retrieve a single lineage record by ID (tenant-scoped).
   */
  @Get(':id')
  async getById(@Param('id') id: string, @Req() req: any) {
    assertLineageAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const record = await this.lineageQueryService.getById(tenantId, id);
    if (!record) {
      throw new NotFoundException(`Lineage record '${id}' not found.`);
    }
    return record;
  }

  /**
   * GET /lineage/by-correlation/:correlationId
   * Return all lineage records that share the same correlation ID.
   * A single request chain may produce multiple records across services.
   */
  @Get('by-correlation/:correlationId')
  async findByCorrelationId(
    @Param('correlationId') correlationId: string,
    @Req() req: any,
  ) {
    assertLineageAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    return this.lineageQueryService.findByCorrelationId(tenantId, correlationId);
  }

  /**
   * GET /lineage/by-user/:userId?limit=…
   * Return lineage records for a specific user (most-recent first).
   */
  @Get('by-user/:userId')
  async findByUserId(
    @Param('userId') userId: string,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    assertLineageAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const take = limit ? Math.min(parseInt(limit, 10), 200) : 50;
    return this.lineageQueryService.findByUserId(tenantId, userId, take);
  }

  /**
   * GET /lineage/audit
   * Flexible audit query with optional filters:
   *   - correlationId: exact match
   *   - userId: exact match
   *   - triggerType: API_REQUEST | SCHEDULED_REFRESH | FORCE_REFRESH | BACKGROUND_JOB | ALERT_TRIGGERED
   *   - sourceEndpoint: substring match
   *   - fromDate: ISO 8601 start date (inclusive)
   *   - toDate: ISO 8601 end date (inclusive)
   *   - limit: max records (default 50, max 200)
   */
  @Get('audit')
  async listForAudit(
    @Query('correlationId') correlationId: string | undefined,
    @Query('userId') userId: string | undefined,
    @Query('triggerType') triggerType: string | undefined,
    @Query('sourceEndpoint') sourceEndpoint: string | undefined,
    @Query('fromDate') fromDate: string | undefined,
    @Query('toDate') toDate: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    assertLineageAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    return this.lineageQueryService.listForAudit(tenantId, {
      correlationId,
      userId,
      triggerType: triggerType as TriggerType | undefined,
      sourceEndpoint,
      fromDate,
      toDate,
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 50,
    });
  }

  /**
   * GET /lineage/stats/trigger-types?fromDate=…&toDate=…
   * Return per-triggerType operation counts for cost analysis.
   */
  @Get('stats/trigger-types')
  async getTriggerTypeStats(
    @Query('fromDate') fromDate: string | undefined,
    @Query('toDate') toDate: string | undefined,
    @Req() req: any,
  ) {
    assertLineageAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    return this.lineageQueryService.getTriggerTypeStats(tenantId, { fromDate, toDate });
  }
}
