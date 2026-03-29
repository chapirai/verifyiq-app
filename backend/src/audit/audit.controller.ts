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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditEventType } from './audit-event.entity';
import { AuditEventQueryService } from './audit-event-query.service';
import { AuditService } from './audit.service';
import { UsageEventQueryService } from './usage-event-query.service';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// ── Permission helpers ────────────────────────────────────────────────────────

/**
 * Roles authorised to access audit/usage events.
 * P02-T09: admin, audit, evidence, compliance roles.
 */
const AUDIT_READ_ROLES = ['admin', 'audit', 'evidence', 'compliance'] as const;

function assertAuditAccess(req: any): void {
  const role = (req.user?.role ?? req.user?.roles?.[0]) as string | undefined;
  if (!role || !(AUDIT_READ_ROLES as readonly string[]).includes(role)) {
    throw new ForbiddenException(
      'Audit event access is restricted to admin, audit, evidence, and compliance roles.',
    );
  }
}

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly auditEventQueryService: AuditEventQueryService,
    private readonly usageEventQueryService: UsageEventQueryService,
  ) {}

  /**
   * GET /audit
   * List legacy audit logs for the authenticated tenant.
   */
  @Get()
  async list(@Query('limit') limit: string | undefined, @Req() req: any): Promise<any[]> {
    assertAuditAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    return this.auditService.listForTenant(tenantId, Number(limit ?? 50));
  }

  /**
   * GET /audit/events/:id
   * Retrieve a single audit event by ID (tenant-scoped).
   */
  @Get('events/:id')
  async getEventById(@Param('id') id: string, @Req() req: any) {
    assertAuditAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const record = await this.auditEventQueryService.getById(tenantId, id);
    if (!record) {
      throw new NotFoundException(`Audit event '${id}' not found.`);
    }
    return record;
  }

  /**
   * GET /audit/events
   * Flexible audit event query with filters.
   */
  @Get('events')
  async listEvents(
    @Query('userId') userId: string | undefined,
    @Query('eventType') eventType: string | undefined,
    @Query('resourceId') resourceId: string | undefined,
    @Query('correlationId') correlationId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('fromDate') fromDate: string | undefined,
    @Query('toDate') toDate: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    assertAuditAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    return this.auditEventQueryService.listForAudit(tenantId, {
      userId,
      eventType: eventType as AuditEventType | undefined,
      resourceId,
      correlationId,
      status,
      fromDate,
      toDate,
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 50,
    });
  }

  /**
   * GET /audit/usage/:id
   * Retrieve a single usage event by ID (tenant-scoped).
   */
  @Get('usage/:id')
  async getUsageById(@Param('id') id: string, @Req() req: any) {
    assertAuditAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    const record = await this.usageEventQueryService.getById(tenantId, id);
    if (!record) {
      throw new NotFoundException(`Usage event '${id}' not found.`);
    }
    return record;
  }

  /**
   * GET /audit/usage
   * Flexible usage event query with filters.
   */
  @Get('usage')
  async listUsageEvents(
    @Query('userId') userId: string | undefined,
    @Query('eventType') eventType: string | undefined,
    @Query('resourceId') resourceId: string | undefined,
    @Query('correlationId') correlationId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('fromDate') fromDate: string | undefined,
    @Query('toDate') toDate: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    assertAuditAccess(req);
    const tenantId = (req.user?.tenantId as string | undefined) ?? DEFAULT_TENANT_ID;
    return this.usageEventQueryService.listForAudit(tenantId, {
      userId,
      eventType: eventType as AuditEventType | undefined,
      resourceId,
      correlationId,
      status,
      fromDate,
      toDate,
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 50,
    });
  }
}
