import type { CanonicalMappingRule } from './canonical-xbrl-mappings';

/** Exported for unit tests and optional reuse by normalizers. */
export function matchConceptToRule(
  conceptQname: string,
  rules: CanonicalMappingRule[],
): CanonicalMappingRule | null {
  const hay = conceptQname.toLowerCase();
  let winner: CanonicalMappingRule | null = null;
  for (const r of rules) {
    if (r.patterns.some(p => hay.includes(p.toLowerCase()))) {
      if (!winner || r.priority > winner.priority) winner = r;
    }
  }
  return winner;
}
