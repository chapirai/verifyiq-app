/**
 * Validates a Swedish organisation number.
 *
 * Accepts 10 or 12 consecutive digits, optionally separated by a single
 * hyphen or space (e.g. "5560000001", "556000-0001", "202100123456").
 *
 * Returns true when the stripped digit string is exactly 10 or 12 digits long.
 */
export function validateOrgNumber(value: string): boolean {
  const digits = value.replace(/[\s-]/g, '');
  return /^(\d{10}|\d{12})$/.test(digits);
}

/**
 * Returns a human-readable error message for an invalid org number, or null
 * when the value is valid.
 */
export function orgNumberError(value: string): string | null {
  if (!value.trim()) return null;
  return validateOrgNumber(value) ? null : 'Enter a valid 10-digit or 12-digit Swedish organisation number';
}
