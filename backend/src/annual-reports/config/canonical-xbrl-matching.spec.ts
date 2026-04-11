import { FINANCIAL_RULES } from './canonical-xbrl-mappings';
import { matchConceptToRule } from './canonical-xbrl-matching';

describe('matchConceptToRule', () => {
  it('maps Swedish-style revenue concepts deterministically', () => {
    const r = matchConceptToRule('{http://example.com}NetSales', FINANCIAL_RULES);
    expect(r?.canonicalField).toBe('revenue');
  });

  it('prefers higher-priority rule when multiple patterns match', () => {
    const r = matchConceptToRule('bas:OperatingProfitLoss', FINANCIAL_RULES);
    expect(r?.canonicalField).toBe('operating_profit');
    expect(r!.priority).toBeGreaterThanOrEqual(85);
  });

  it('returns null when nothing matches', () => {
    expect(matchConceptToRule('bas:TotallyUnknownConcept', FINANCIAL_RULES)).toBeNull();
  });
});
