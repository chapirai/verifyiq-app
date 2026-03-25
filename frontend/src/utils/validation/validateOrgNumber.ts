/**
 * Validates a Swedish organisation number.
 *
 * Accepts 12 consecutive digits (NNNNNNNNNNNN), optionally separated by
 * a single hyphen or space at position 8 (e.g. NNNNNNNN-NNNN or NNNNNNNN NNNN).
 *
 * Returns true when the stripped digit string is exactly 12 digits long.
 */
export function validateOrgNumber(value: string): boolean {
  const digits = value.replace(/[\s-]/g, '');
  return /^\d{12}$/.test(digits);
}

/**
 * Returns a human-readable error message for an invalid org number, or null
 * when the value is valid.
 */
export function orgNumberError(value: string): string | null {
  if (!value.trim()) return null;
  return validateOrgNumber(value) ? null : 'Enter a valid 12-digit Swedish organisation number';
}
