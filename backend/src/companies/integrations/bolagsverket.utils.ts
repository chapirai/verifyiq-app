import { basename } from 'path';

const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F]/g;
const QUOTE_CHAR_REGEX = /["';]/g;
const MAX_FILENAME_LENGTH = 255;

export function sanitizeBolagsverketFilename(input?: string): string | undefined {
  if (!input) return undefined;

  let decoded = input;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    decoded = input;
  }

  // Normalise Windows-style backslash separators so that basename() correctly
  // extracts the file name component on both Unix and Windows paths.
  const normalized = decoded.replace(/\\/g, '/');
  const baseName = basename(normalized);
  const sanitized = baseName
    .replace(CONTROL_CHAR_REGEX, '')
    .replace(QUOTE_CHAR_REGEX, '')
    .trim()
    .slice(0, MAX_FILENAME_LENGTH);

  return sanitized || undefined;
}
