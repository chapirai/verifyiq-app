export type CompanySignalDriver = {
  key: string;
  value?: unknown;
  weight?: string;
  detail?: string;
  impact?: string;
};

export type CompanySignalExplanation = {
  definition?: string;
  drivers?: CompanySignalDriver[];
};

export type CompanySignalRow = {
  signal_type: string;
  definition: string;
  engine_version: string | null;
  score: number | null;
  explanation: CompanySignalExplanation | null;
  computed_at: string | null;
};

export type CompanySignalsResponse = {
  organisation_number: string;
  engine_catalog_version: string;
  data: CompanySignalRow[];
};

export type CompanySignalsRecomputeResponse = {
  queued: boolean;
  job_id: string;
  organisation_number: string;
  engine_version: string;
};

export type CompanySignalsJobStatus = {
  id: string;
  name: string;
  state: string;
  attempts_made: number;
  processed_on: number | null;
  finished_on: number | null;
  failed_reason: string | null;
};
