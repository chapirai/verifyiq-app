import {
  extractAktieslagVotingSummary,
  extractOwnershipEdgesFromFiOrganisationRaw,
  parseInsatsPercent,
} from './ownership-bv-extract.util';

describe('parseInsatsPercent', () => {
  it('parses Swedish-style percentages', () => {
    expect(parseInsatsPercent('25,5 %')).toBe(25.5);
    expect(parseInsatsPercent('33.33%')).toBeCloseTo(33.33);
  });
});

describe('extractOwnershipEdgesFromFiOrganisationRaw', () => {
  it('extracts partner edge when insats is present', () => {
    const raw = {
      identitet: { identitetsbeteckning: '5560001234' },
      organisationsnamn: { namn: 'HB Demo' },
      organisationsengagemang: {
        funktionarsOrganisationsengagemang: [
          {
            organisation: {
              identitet: { identitetsbeteckning: '5560001234' },
              organisationsnamn: { namn: 'HB Demo' },
            },
            funktionar: {
              personnamn: { fornamn: 'Ada', efternamn: 'Testsson' },
              identitet: { identitetsbeteckning: '197001011234' },
              insats: '40 %',
            },
          },
        ],
      },
    };
    const edges = extractOwnershipEdgesFromFiOrganisationRaw(raw, '5560001234');
    expect(edges).toHaveLength(1);
    expect(edges[0].ownerType).toBe('person');
    expect(edges[0].ownershipPercentage).toBe(40);
    expect(edges[0].controlPercentage).toBeNull();
    expect(edges[0].ownedOrganisationNumber).toBe('5560001234');
  });

  it('skips engagements for a different related organisation', () => {
    const raw = {
      identitet: { identitetsbeteckning: '5560001234' },
      organisationsengagemang: {
        funktionarsOrganisationsengagemang: [
          {
            organisation: {
              identitet: { identitetsbeteckning: '5599999999' },
              organisationsnamn: { namn: 'Other AB' },
            },
            funktionar: {
              personnamn: { fornamn: 'Ada', efternamn: 'Testsson' },
              insats: '40 %',
            },
          },
        ],
      },
    };
    expect(extractOwnershipEdgesFromFiOrganisationRaw(raw, '5560001234')).toHaveLength(0);
  });
});

describe('extractAktieslagVotingSummary', () => {
  it('summarises share classes for lineage', () => {
    const raw = {
      aktieinformation: {
        antalAktier: 1000,
        aktieslag: [
          { namn: 'A', antal: 100, rostvarde: '10' },
          { namn: 'B', antal: 900, rostvarde: '1' },
        ],
      },
    };
    const s = extractAktieslagVotingSummary(raw);
    expect(s?.totalAntalAktier).toBe(1000);
    expect((s?.classes as unknown[]).length).toBe(2);
  });
});
