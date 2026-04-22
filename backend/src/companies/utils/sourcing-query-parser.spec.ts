import { parseSourcingQueryText } from './sourcing-query-parser';

describe('parseSourcingQueryText', () => {
  it('extracts 10-digit org number and uses remainder as q', () => {
    const { filters, notes } = parseSourcingQueryText('5565683058 nordic logistics');
    expect(filters.org_number).toBe('5565683058');
    expect(filters.q).toBe('nordic logistics');
    expect(notes.some((n) => n.includes('organisation number'))).toBe(true);
  });

  it('normalises dashed org number', () => {
    const { filters } = parseSourcingQueryText('Org 556568-3058');
    expect(filters.org_number).toBe('5565683058');
  });

  it('maps konkurs to BANKRUPT', () => {
    const { filters } = parseSourcingQueryText('konkurs bolag i stockholm');
    expect(filters.status).toBe('BANKRUPT');
    expect(filters.q).toContain('stockholm');
  });

  it('maps aktiebolag to company_form_contains', () => {
    const { filters } = parseSourcingQueryText('aktiebolag med stål');
    expect(filters.company_form_contains).toBe('Aktiebolag');
    expect(filters.q).toContain('stål');
  });
});
