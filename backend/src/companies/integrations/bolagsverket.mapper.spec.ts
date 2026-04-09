import { BolagsverketMapper } from './bolagsverket.mapper';

describe('BolagsverketMapper bestammelser normalization', () => {
  let mapper: BolagsverketMapper;

  beforeEach(() => {
    mapper = new BolagsverketMapper();
  });

  const makeRichOrg = (bestammelser: unknown) => [
    {
      identitetsbeteckning: '5565595450',
      namn: 'Testbolaget AB',
      bestammelser,
    } as any,
  ];

  it('maps bestammelser when payload is an array', () => {
    const result = mapper.map(null, makeRichOrg([
      { bestammelsetyp: 'A', text: 'Rule A', registreringsdatum: '2024-01-01' },
    ]));
    expect(Array.isArray(result.v4Section?.bestammelser)).toBe(true);
    expect(result.v4Section?.bestammelser).toEqual([
      { bestammelsetyp: 'A', text: 'Rule A', registreringsdatum: '2024-01-01' },
    ]);
  });

  it('wraps bestammelser when payload is a single object', () => {
    const result = mapper.map(null, makeRichOrg({
      bestammelsetyp: 'B',
      text: 'Rule B',
      registreringsdatum: '2024-02-01',
    }));
    expect(Array.isArray(result.v4Section?.bestammelser)).toBe(true);
    expect(result.v4Section?.bestammelser).toEqual([
      { bestammelsetyp: 'B', text: 'Rule B', registreringsdatum: '2024-02-01' },
    ]);
  });

  it('returns empty array when bestammelser is null or undefined', () => {
    const nullResult = mapper.map(null, makeRichOrg(null));
    const undefinedResult = mapper.map(null, makeRichOrg(undefined));
    expect(nullResult.v4Section?.bestammelser).toEqual([]);
    expect(undefinedResult.v4Section?.bestammelser).toEqual([]);
  });

  it('returns empty array and does not throw when bestammelser is invalid primitive', () => {
    expect(() => mapper.map(null, makeRichOrg('invalid-primitive'))).not.toThrow();
    const result = mapper.map(null, makeRichOrg('invalid-primitive'));
    expect(result.v4Section?.bestammelser).toEqual([]);
  });
});
