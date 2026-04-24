export type IngestionProgress = {
  runId: string;
  phase: string;
  recordsSeen: number;
  recordsInserted: number;
  recordsFailed: number;
  memoryRssMb: number;
  at: string;
};

