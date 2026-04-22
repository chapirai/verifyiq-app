export interface TargetList {
  id: string;
  tenantId: string;
  name: string;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  organisationNumbers: string[];
  playbook?: {
    dealMode?: 'founder_exit' | 'distressed' | 'roll_up';
    thesis?: string;
  };
}
