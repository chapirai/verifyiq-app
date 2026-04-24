export type SourceRefreshResult = {
  source: string;
  status: 'ok' | 'failed' | 'skipped';
  errorMessage?: string;
  attemptedAt: string;
};

