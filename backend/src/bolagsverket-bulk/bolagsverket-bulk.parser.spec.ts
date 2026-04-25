import { BolagsverketBulkParser } from './bolagsverket-bulk.parser';

describe('BolagsverketBulkParser', () => {
  const parser = new BolagsverketBulkParser();

  it('parses organisationsidentitet using first $ only', () => {
    const line = [
      '5564409893$ORGNR-IDORG',
      '',
      'SE-LAND',
      'Testbolaget AB$FORETAGSNAMN-ORGNAM$2024-01-01',
      'AB-ORGFO',
      '',
      '',
      '',
      '2024-01-01',
      'Konsultverksamhet',
      'Box 1$$UPPSALA$75023$SE-LAND',
    ].join(';');
    const out = parser.parseLineToStaging(line);
    expect(out.identityValue).toBe('5564409893');
    expect(out.identityType).toBe('ORGNR-IDORG');
    expect(out.organisationNumber).toBe('5564409893');
    expect(out.personalIdentityNumber).toBeNull();
  });

  it('keeps $$ position for missing C/O in postadress', () => {
    const line = [
      '5564409893$ORGNR-IDORG',
      '',
      'SE-LAND',
      'Testbolaget AB$FORETAGSNAMN-ORGNAM$2024-01-01',
      'AB-ORGFO',
      '',
      '',
      '',
      '2024-01-01',
      'Konsultverksamhet',
      'Box 23082$$UPPSALA$75023$SE-LAND',
    ].join(';');
    const out = parser.parseLineToStaging(line);
    expect(out.deliveryAddress).toBe('Box 23082');
    expect(out.coAddress).toBeNull();
    expect(out.city).toBe('UPPSALA');
    expect(out.postalCode).toBe('75023');
    expect(out.countryCode).toBe('SE-LAND');
    expect(out.postalParseWarning).toBeNull();
  });

  it('parses names with extra part and chooses foretagsnamn as primary', () => {
    const line = [
      '5564409893$ORGNR-IDORG',
      '',
      'SE-LAND',
      'Alias AB$NAMN-ORGNAM$2020-01-01|Huvudnamn AB$FORETAGSNAMN-ORGNAM$2019-01-01$extra',
      'AB-ORGFO',
      '',
      '',
      '',
      '2019-01-01',
      'Beskrivning',
      'A$$STOCKHOLM$11122$SE-LAND',
    ].join(';');
    const out = parser.parseLineToStaging(line);
    expect(out.namesAll).toHaveLength(2);
    expect(out.namesAll[1]?.extra).toBe('extra');
    expect(out.namePrimary).toBe('Huvudnamn AB');
    expect(out.primaryNameTypeCode).toBe('FORETAGSNAMN-ORGNAM');
  });

  it('parses restructuring entries that start with leading |', () => {
    const line = [
      '5564409893$ORGNR-IDORG',
      '',
      'SE-LAND',
      'Test AB$FORETAGSNAMN-ORGNAM$2024-01-01',
      'AB-ORGFO',
      '',
      '',
      '|LI-AVOMFO$2004-12-31',
      '2024-01-01',
      'Beskrivning',
      'A$$MALMO$21122$SE-LAND',
    ].join(';');
    const out = parser.parseLineToStaging(line);
    expect(out.hasActiveRestructuringOrWindup).toBe(true);
    expect(out.activeRestructuringCodes).toContain('LI-AVOMFO');
    expect(out.restructuringEntries[0]?.fromDate).toBe('2004-12-31');
  });

  it('fails malformed rows with wrong number of columns', () => {
    expect(() => parser.parseLineToStaging('a;b;c')).toThrow('Expected 11 columns');
  });
});

