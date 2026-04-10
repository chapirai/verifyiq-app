/**
 * dokumentlista rows may use dokumentId, dokumentid, or DokumentId depending on serializer.
 * Only values from this list may be passed to GET …/hvd/dokument/:id.
 */
export function pickDokumentIdFromListRow(row: Record<string, unknown>): string | null {
  const v = row.dokumentId ?? row.dokumentid ?? row.DokumentId;
  if (v === undefined || v === null) return null;
  const s = typeof v === 'string' ? v.trim() : String(v).trim();
  return s.length > 0 ? s : null;
}
