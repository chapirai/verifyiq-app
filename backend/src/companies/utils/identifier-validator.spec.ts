import { ID_REGEX, classifyIdentifier, validateIdentifier } from './identifier-validator';

describe('identifier-validator', () => {
  describe('ID_REGEX', () => {
    it('accepts a 10-digit organisationsnummer', () => {
      expect(ID_REGEX.test('5560000001')).toBe(true);
    });

    it('accepts a 12-digit personnummer', () => {
      expect(ID_REGEX.test('197001011234')).toBe(true);
    });

    it('accepts a GD-nummer (302XXXXXXX)', () => {
      expect(ID_REGEX.test('3020000001')).toBe(true);
    });

    it('rejects an 11-digit number', () => {
      expect(ID_REGEX.test('55600000011')).toBe(false);
    });

    it('rejects a value with letters', () => {
      expect(ID_REGEX.test('AB1234567')).toBe(false);
    });

    it('rejects a 9-digit number (too short)', () => {
      expect(ID_REGEX.test('123456789')).toBe(false);
    });

    it('rejects an empty string', () => {
      expect(ID_REGEX.test('')).toBe(false);
    });

    it('rejects a number with a hyphen separator', () => {
      expect(ID_REGEX.test('556000-0001')).toBe(false);
    });
  });

  describe('validateIdentifier', () => {
    it('returns true for a valid 10-digit organisationsnummer', () => {
      expect(validateIdentifier('5560000001')).toBe(true);
    });

    it('returns true for a valid 12-digit personnummer', () => {
      expect(validateIdentifier('197001011234')).toBe(true);
    });

    it('returns true for a valid GD-nummer', () => {
      expect(validateIdentifier('3020000001')).toBe(true);
    });

    it('returns false for an 11-digit number', () => {
      expect(validateIdentifier('55600000011')).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(validateIdentifier('')).toBe(false);
    });

    it('returns false for a value with a hyphen', () => {
      expect(validateIdentifier('556000-0001')).toBe(false);
    });
  });

  describe('classifyIdentifier', () => {
    it('classifies a 10-digit number as organisationsnummer', () => {
      expect(classifyIdentifier('5560000001')).toBe('organisationsnummer');
    });

    it('classifies a 12-digit number as personnummer', () => {
      expect(classifyIdentifier('197001011234')).toBe('personnummer');
    });

    it('classifies a GD-nummer correctly', () => {
      expect(classifyIdentifier('3020000001')).toBe('gd_nummer');
    });

    it('returns invalid for an 11-digit number', () => {
      expect(classifyIdentifier('55600000011')).toBe('invalid');
    });

    it('returns invalid for an empty string', () => {
      expect(classifyIdentifier('')).toBe('invalid');
    });

    it('returns invalid for a value with letters', () => {
      expect(classifyIdentifier('AB1234567')).toBe('invalid');
    });

    it('returns invalid for a value with a hyphen separator', () => {
      expect(classifyIdentifier('556000-0001')).toBe('invalid');
    });

    it('prioritises gd_nummer over organisationsnummer for 302XXXXXXX', () => {
      // GD-nummer is a 10-digit number starting with 302, must be classified as gd_nummer
      expect(classifyIdentifier('3021234567')).toBe('gd_nummer');
    });
  });
});
