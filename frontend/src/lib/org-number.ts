/** Normalise Swedish org / person id for API calls (digits only, 10 or 12 chars typical). */
export function normalizeIdentitetsbeteckning(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isLikelyOrgNumberParam(id: string): boolean {
  const n = normalizeIdentitetsbeteckning(id);
  return n.length === 10 || n.length === 12;
}
