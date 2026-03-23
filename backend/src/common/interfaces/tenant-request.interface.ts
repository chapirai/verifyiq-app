import { Request } from 'express';

export interface TenantRequest extends Request {
  user?: {
    sub?: string;
    tenantId?: string;
    roles?: string[];
    email?: string;
    [key: string]: unknown;
  };
}
