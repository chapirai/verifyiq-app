import { Injectable } from '@nestjs/common';

export type ExtractedSection = {
  sectionOrder: number;
  headingText: string | null;
  headingLevel: number | null;
  normalizedHeading: string | null;
  textContent: string | null;
};

@Injectable()
export class AnnualReportSectionExtractorService {
  /**
   * Lightweight heading extraction from XHTML (deterministic regex; no full DOM).
   */
  extractSections(xhtmlContent: string, maxSections = 200): ExtractedSection[] {
    const slice = xhtmlContent.slice(0, 1_500_000);
    const re = /<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
    const out: ExtractedSection[] = [];
    let m: RegExpExecArray | null;
    let order = 0;
    while ((m = re.exec(slice)) !== null && out.length < maxSections) {
      const level = parseInt(m[1], 10);
      const rawInner = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!rawInner) continue;
      const normalized = rawInner.toLowerCase().normalize('NFC');
      out.push({
        sectionOrder: order++,
        headingText: rawInner.slice(0, 2000),
        headingLevel: Number.isFinite(level) ? level : null,
        normalizedHeading: normalized.slice(0, 512),
        textContent: null,
      });
    }
    return out;
  }

  /** Best-effort nearest heading for a byte offset in the document (for future fact anchoring). */
  nearestHeadingBefore(sections: ExtractedSection[], _offset: number): string | null {
    if (!sections.length) return null;
    return sections[sections.length - 1]?.headingText ?? null;
  }
}
