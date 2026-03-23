import { Injectable } from '@nestjs/common';
import { ScreeningProvider, ScreeningProviderResult } from './screening-provider.interface';

@Injectable()
export class MockScreeningProvider implements ScreeningProvider {
  readonly name = 'mock_provider';

  async screen(input: { displayName: string; organisationNumber?: string | null }): Promise<ScreeningProviderResult> {
    const risky = /global|sanction|offshore|pep/i.test(input.displayName);
    return {
      requestPayload: input,
      responsePayload: {
        provider: this.name,
        generatedAt: new Date().toISOString(),
      },
      matches: risky
        ? [
            {
              category: 'sanctions',
              source: 'mock_watchlist',
              score: 92,
              subjectName: input.displayName,
              payload: { rationale: 'Name matched mock sanctions heuristics' },
            },
          ]
        : [],
    };
  }
}
