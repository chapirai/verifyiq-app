import JSZip from 'jszip';
import { AnnualReportZipError, AnnualReportZipService } from './annual-report-zip.service';

describe('AnnualReportZipService', () => {
  const service = new AnnualReportZipService();

  it('rejects malformed ZIP data', async () => {
    await expect(service.extractSafe(Buffer.from('not a real zip'))).rejects.toBeInstanceOf(
      AnnualReportZipError,
    );
  });

  it('rejects zip-slip style paths', async () => {
    const zip = new JSZip();
    zip.file('../outside.txt', 'evil');
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    await expect(service.extractSafe(buf)).rejects.toMatchObject({ code: 'zip_slip' });
  });

  it('extracts manifest and marks iXBRL candidates', async () => {
    const zip = new JSZip();
    const xhtml = `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL">
<body><ix:nonFraction name="t:Revenue" contextRef="c" unitRef="u" format="ixt:num-dot-decimal">100</ix:nonFraction></body>
</html>`;
    zip.file('reports/annual.xhtml', xhtml);
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const out = await service.extractSafe(buf);
    try {
      expect(out.manifest.some(m => m.pathInArchive === 'reports/annual.xhtml')).toBe(true);
      expect(out.ixbrlCandidates.length).toBeGreaterThan(0);
      expect(service.pickIxbrlPath(out.ixbrlCandidates)).toBe('reports/annual.xhtml');
    } finally {
      await service.cleanupWorkDir(out.workDir);
    }
  });
});
