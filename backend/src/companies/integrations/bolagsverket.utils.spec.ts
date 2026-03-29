import { sanitizeBolagsverketFilename } from './bolagsverket.utils';

describe('sanitizeBolagsverketFilename', () => {
  it('returns undefined for undefined input', () => {
    expect(sanitizeBolagsverketFilename(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(sanitizeBolagsverketFilename('')).toBeUndefined();
  });

  it('returns a simple filename unchanged', () => {
    expect(sanitizeBolagsverketFilename('report.zip')).toBe('report.zip');
  });

  it('extracts the basename from a path', () => {
    expect(sanitizeBolagsverketFilename('/tmp/documents/report.zip')).toBe('report.zip');
  });

  it('extracts the basename from a Windows-style path', () => {
    expect(sanitizeBolagsverketFilename('C:\\Users\\user\\report.zip')).toBe('report.zip');
  });

  it('URL-decodes percent-encoded filenames', () => {
    expect(sanitizeBolagsverketFilename('rapport%202024.zip')).toBe('rapport 2024.zip');
  });

  it('handles UTF-8 RFC 5987 encoded filenames', () => {
    // The input would be the raw value after the UTF-8'' prefix is stripped
    expect(sanitizeBolagsverketFilename('rapport%C3%A5r.zip')).toBe('rapportår.zip');
  });

  it('returns the input as-is when percent-decoding fails', () => {
    // Invalid percent-encoding should not throw; falls back to raw
    expect(sanitizeBolagsverketFilename('file%ZZ.zip')).toBe('file%ZZ.zip');
  });

  it('strips control characters', () => {
    expect(sanitizeBolagsverketFilename('file\u0001\u001Fname.zip')).toBe('filename.zip');
  });

  it('strips quote characters', () => {
    expect(sanitizeBolagsverketFilename('fi"le\'na;me.zip')).toBe('filename.zip');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeBolagsverketFilename('  report.zip  ')).toBe('report.zip');
  });

  it('truncates filenames longer than 255 characters', () => {
    const longName = 'a'.repeat(260) + '.zip';
    const result = sanitizeBolagsverketFilename(longName);
    expect(result).toBeDefined();
    expect(result!.length).toBeLessThanOrEqual(255);
  });

  it('returns undefined when the result after sanitization is empty', () => {
    // A filename consisting entirely of stripped characters
    expect(sanitizeBolagsverketFilename('\u0001\u0002\u0003')).toBeUndefined();
  });
});
