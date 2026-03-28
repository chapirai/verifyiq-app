/**
 * Swedish identifier validation pipeline.
 *
 * Covers the three identifier types accepted by Bolagsverket:
 *   - organisationsnummer:  exactly 10 digits
 *   - personnummer / samordningsnummer:  exactly 12 digits
 *   - GD-nummer:  "302" followed by exactly 7 digits (10 digits total)
 *
 * Separators (hyphen or space) are stripped before validation so that
 * user-friendly input like "556000-0001" or "19700101 1234" is accepted.
 */

export type IdentifierType =
  | 'organisationsnummer'
  | 'personnummer'
  | 'gd_nummer'
  | 'invalid';

/** Strip whitespace and hyphens to obtain a raw digit string. */
export function normaliseIdentifier(value: string): string {
  return value.replace(/[\s-]/g, '');
}

/**
 * Classifies a (possibly formatted) input string into one of the recognised
 * Swedish identifier types, or 'invalid' when it doesn't match any accepted
 * pattern.
 */
export function classifyIdentifier(value: string): IdentifierType {
  const digits = normaliseIdentifier(value);

  if (/^302\d{7}$/.test(digits)) return 'gd_nummer';
  if (/^\d{12}$/.test(digits)) return 'personnummer';
  if (/^\d{10}$/.test(digits)) return 'organisationsnummer';

  return 'invalid';
}

/**
 * Returns true when the input matches one of the accepted identifier formats
 * (after stripping separators).
 */
export function validateIdentifier(value: string): boolean {
  return classifyIdentifier(value) !== 'invalid';
}

/** Human-readable label for each identifier type. */
export const IDENTIFIER_TYPE_LABELS: Record<IdentifierType, string> = {
  organisationsnummer: 'Organisation number',
  personnummer: 'Personnummer',
  gd_nummer: 'GD-nummer',
  invalid: 'Invalid identifier',
};

/**
 * Returns a human-readable error message for an invalid identifier, or null
 * when the value is valid.  Returns null for an empty/whitespace-only input so
 * the field does not show an error before the user has typed anything.
 */
export function identifierError(value: string): string | null {
  if (!value.trim()) return null;
  return validateIdentifier(value)
    ? null
    : 'Enter a valid Swedish organisation number (10 or 12 digits) or personnummer (12 digits)';
}
