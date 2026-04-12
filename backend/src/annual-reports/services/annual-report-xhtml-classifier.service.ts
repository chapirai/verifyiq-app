import { Injectable } from '@nestjs/common';
import type { AnnualReportDocumentType } from '../entities/annual-report-source-file.entity';

export type XhtmlClassification = {
  documentType: AnnualReportDocumentType;
  score: number;
  reasons: string[];
};

const AR_FILENAME = [/arsredovisning/i, /annual/i, /report/i, /bokslut/i];
const AUDIT_FILENAME = [/revision/i, /audit/i, /granskning/i];

const AR_BODY = [
  'årsredovisning',
  'förvaltningsberättelse',
  'resultaträkning',
  'balansräkning',
  'kassaflödesanalys',
  'eget kapital',
  'noter',
  'resultat- och balansräkning',
];

const AUDIT_BODY = [
  'revisionsberättelse',
  'till bolagsstämman',
  'revisorns ansvar',
  'styrelsens ansvar',
  'uttalanden',
  'grund för uttalanden',
  'auktoriserad revisor',
  'auktoriserad revisor',
  'fortsatt drift',
  'anmärkning',
  'revision',
];

@Injectable()
export class AnnualReportXhtmlClassifierService {
  /**
   * Deterministic classification from path + XHTML string (no network, no ML).
   */
  classifyXhtmlDocument(fileMetadata: { pathInArchive: string; originalFilename?: string | null }, xhtmlContent: string): XhtmlClassification {
    const reasons: string[] = [];
    let arScore = 0;
    let auditScore = 0;

    const path = `${fileMetadata.pathInArchive} ${fileMetadata.originalFilename ?? ''}`.toLowerCase();
    for (const re of AR_FILENAME) {
      if (re.test(path)) {
        arScore += 4;
        reasons.push(`filename_matches_annual:${re.source}`);
      }
    }
    for (const re of AUDIT_FILENAME) {
      if (re.test(path)) {
        auditScore += 4;
        reasons.push(`filename_matches_audit:${re.source}`);
      }
    }

    const headSlice = xhtmlContent.slice(0, 400_000);
    const lower = headSlice.toLowerCase();

    const titleMatch = headSlice.match(/<title[^>]*>([^<]{1,500})<\/title>/i);
    if (titleMatch) {
      const t = titleMatch[1].toLowerCase();
      if (t.includes('revisionsberättelse') || t.includes('revision')) {
        auditScore += 5;
        reasons.push('title_audit_marker');
      }
      if (t.includes('årsredovisning') || t.includes('arsredovisning')) {
        arScore += 5;
        reasons.push('title_annual_marker');
      }
    }

    const headingRe = /<h[1-6][^>]*>([^<]{1,400})<\/h[1-6]>/gi;
    let hm: RegExpExecArray | null;
    while ((hm = headingRe.exec(headSlice)) !== null) {
      const h = hm[1].toLowerCase().replace(/\s+/g, ' ').trim();
      for (const m of AR_BODY) {
        if (h.includes(m)) {
          arScore += 3;
          reasons.push(`heading_ar:${m}`);
        }
      }
      for (const m of AUDIT_BODY) {
        if (h.includes(m)) {
          auditScore += 3;
          reasons.push(`heading_audit:${m}`);
        }
      }
    }

    for (const m of AR_BODY) {
      if (lower.includes(m)) {
        arScore += 1;
        reasons.push(`body_keyword_ar:${m}`);
      }
    }
    for (const m of AUDIT_BODY) {
      if (lower.includes(m)) {
        auditScore += 1;
        reasons.push(`body_keyword_audit:${m}`);
      }
    }

    let documentType: AnnualReportDocumentType = 'unknown';
    if (auditScore >= 6 && auditScore > arScore) {
      documentType = 'audit_report';
    } else if (arScore >= 4 && arScore >= auditScore) {
      documentType = 'annual_report';
    } else if (auditScore >= 4) {
      documentType = 'audit_report';
    } else if (arScore >= 2) {
      documentType = 'annual_report';
    }

    const score = Math.max(arScore, auditScore);
    return { documentType, score, reasons: [...new Set(reasons)].slice(0, 40) };
  }
}
