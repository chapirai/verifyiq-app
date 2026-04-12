import { AnnualReportXhtmlClassifierService } from './annual-report-xhtml-classifier.service';

describe('AnnualReportXhtmlClassifierService', () => {
  const svc = new AnnualReportXhtmlClassifierService();

  it('classifies audit from filename', () => {
    const r = svc.classifyXhtmlDocument(
      { pathInArchive: 'content/Revisionsberättelse.xhtml', originalFilename: 'Revisionsberättelse.xhtml' },
      '<html><body><p>x</p></body></html>',
    );
    expect(r.documentType).toBe('audit_report');
    expect(r.score).toBeGreaterThanOrEqual(4);
  });

  it('classifies annual report from Swedish body markers', () => {
    const xhtml = `<html><head><title>x</title></head><body>
      <h1>Årsredovisning</h1>
      <p>Balansräkning och resultaträkning enligt nedan.</p>
    </body></html>`;
    const r = svc.classifyXhtmlDocument({ pathInArchive: 'doc.xhtml' }, xhtml);
    expect(r.documentType).toBe('annual_report');
    expect(r.reasons.some(x => x.startsWith('heading_ar:'))).toBe(true);
  });

  it('classifies audit from title and headings over generic path', () => {
    const xhtml = `<html><head><title>Revisionsberättelse</title></head><body>
      <h2>Revisorns ansvar</h2>
      <p>Grund för uttalanden.</p>
    </body></html>`;
    const r = svc.classifyXhtmlDocument({ pathInArchive: 'unknown.xhtml' }, xhtml);
    expect(r.documentType).toBe('audit_report');
  });
});
