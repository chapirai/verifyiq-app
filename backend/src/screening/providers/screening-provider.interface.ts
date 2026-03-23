export interface ScreeningProviderResult {
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  matches: Array<{
    category: string;
    source: string;
    score: number;
    subjectName: string;
    payload: Record<string, unknown>;
  }>;
}

export interface ScreeningProvider {
  readonly name: string;
  screen(input: { displayName: string; organisationNumber?: string | null }): Promise<ScreeningProviderResult>;
}
