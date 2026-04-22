export interface MonitoringSubscription {
  id: string;
  tenantId: string;
  partyId: string | null;
  companyId: string | null;
  status: string;
  eventTypes: string[];
  subjectType: string;
  organisationNumber: string | null;
  personnummer: string | null;
  datasetFamilies: string[];
  alertConfig: Record<string, unknown>;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonitoringAlert {
  id: string;
  tenantId: string;
  subscriptionId: string;
  alertType: string;
  severity: string;
  status: string;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  datasetFamily: string | null;
  organisationNumber: string | null;
  personnummer: string | null;
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonitoringGroupedFeedRow {
  organisationNumber: string | null;
  alertType: string;
  latestCreatedAt: string;
  alertCount: number;
  openCount: number;
}

export interface CreateMonitoringSubscriptionPayload {
  eventTypes: string[];
  subjectType?: string;
  organisationNumber?: string;
  personnummer?: string;
  datasetFamilies?: string[];
  alertConfig?: Record<string, unknown>;
}
