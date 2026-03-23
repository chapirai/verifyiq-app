export interface TenantContext {
  tenantId: string;
  actorId?: string | null;
  roles?: string[];
  email?: string | null;
}
