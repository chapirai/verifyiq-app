import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CachePolicyEvaluationService } from '../services/cache-policy-evaluation.service';

/** Roles permitted to read cache policy configuration. */
const POLICY_READ_ROLES = ['admin', 'compliance'] as const;

function assertPolicyReadAccess(req: any): void {
  const role = (req.user?.role ?? req.user?.roles?.[0]) as string | undefined;
  if (!role || !(POLICY_READ_ROLES as readonly string[]).includes(role)) {
    throw new ForbiddenException(
      'Cache policy access is restricted to admin and compliance roles.',
    );
  }
}

/**
 * P02-T04: Read-only admin API for cache policy configuration.
 *
 * Write / CRUD operations are out-of-scope for this ticket and will be
 * introduced in a follow-up phase.
 */
@Controller('cache-policies')
@UseGuards(JwtAuthGuard)
export class CachePolicyController {
  constructor(
    private readonly cachePolicyEvaluationService: CachePolicyEvaluationService,
  ) {}

  /**
   * GET /cache-policies
   * List all active cache policies (admin/compliance only).
   */
  @Get()
  async listPolicies(@Req() req: any) {
    assertPolicyReadAccess(req);
    return this.cachePolicyEvaluationService.listPolicies();
  }

  /**
   * GET /cache-policies/:id
   * Retrieve a specific policy by ID (admin/compliance only).
   */
  @Get(':id')
  async getPolicyById(@Param('id') id: string, @Req() req: any) {
    assertPolicyReadAccess(req);
    const policy = await this.cachePolicyEvaluationService.getPolicyById(id);
    if (!policy) {
      throw new NotFoundException(`Cache policy '${id}' not found.`);
    }
    return policy;
  }
}
