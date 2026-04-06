/**
 * Bolagsverket KodKlartext shape.
 * Some fields returned by the Bolagsverket APIs can be either a plain string
 * or a structured { kod, klartext } object. This type captures both forms.
 */
export type KodKlartext = { kod?: string; klartext?: string };

/**
 * Convert a `string | KodKlartext | null` value to a plain display string.
 * Preference order: klartext → kod → null.
 * Plain strings are returned as-is, keeping output identical for existing data.
 */
export function toText(v?: string | KodKlartext | null): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  return v.klartext ?? v.kod ?? null;
}
