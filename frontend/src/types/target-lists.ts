export interface TargetList {
  id: string;
  tenantId: string;
  name: string;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  organisationNumbers: string[];
}
