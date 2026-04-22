export type DecisionInsightDriver = {
  key: string;
  value: unknown;
  meaning: string;
  source?: {
    table: string;
    id: string | null;
    pointer: string | null;
  };
};

export type CompanyDecisionInsight = {
  organisation_number: string;
  legal_name: string;
  strategy_mode: string;
  summary: string;
  recommended_action: string;
  confidence: 'low' | 'medium' | 'high' | string;
  drivers: DecisionInsightDriver[];
  generated_at: string;
};

export type CompanyDecisionInsightSnapshot = {
  id: string;
  organisation_number: string;
  strategy_mode: string;
  summary: string;
  recommended_action: string;
  confidence: string;
  scores: Record<string, unknown>;
  drivers: Array<Record<string, unknown>>;
  created_at: string;
};

