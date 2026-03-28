/**
 * Swedish identifier validation pipeline.
 *
 * Covers the three identifier types accepted by Bolagsverket:
 *   - organisationsnummer:  exactly 10 digits
 *   - personnummer / samordningsnummer:  exactly 12 digits
 *   - GD-nummer:  "302" followed by exactly 7 digits (10 digits total)
 *
 * Separators (hyphen or space) are NOT accepted here; callers that want to
 * normalise user input must strip them before calling these helpers.
 */

export const ID_REGEX = /^(\d{10}|\d{12}|302\d{7})$/;

export type IdentifierType =
  | 'organisationsnummer'
  | 'personnummer'
  | 'gd_nummer'
  | 'invalid';

/**
 * Classifies a stripped (no separators) digit string into one of the
 * recognised Swedish identifier types, or 'invalid' when it doesn't match
 * any accepted pattern.
 */
export function classifyIdentifier(value: string): IdentifierType {
  if (!value) return 'invalid';

  if (/^302\d{7}$/.test(value)) return 'gd_nummer';
  if (/^\d{12}$/.test(value)) return 'personnummer';
  if (/^\d{10}$/.test(value)) return 'organisationsnummer';

  return 'invalid';
}

/**
 * Returns true when the value matches one of the accepted identifier formats.
 */
export function validateIdentifier(value: string): boolean {
  return ID_REGEX.test(value);
}
