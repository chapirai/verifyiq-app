import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as unzipper from 'unzipper';

const IXBRL_MARKERS = [
  'http://www.xbrl.org/2013/inlineXBRL',
  'http://www.xbrl.org/2008/inlineXBRL',
  'ix:nonfraction',
  'ix:nonNumeric',
  'nonFraction',
  'nonNumeric',
  'inlineXBRL',
];

export type SafeZipExtractResult = {
  workDir: string;
  manifest: Array<{
    pathInArchive: string;
    uncompressedSize: number;
    isDirectory: boolean;
    contentSha256?: string;
    isCandidateIxbrl: boolean;
  }>;
  ixbrlCandidates: Array<{ pathInArchive: string; score: number }>;
};

export class AnnualReportZipError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'AnnualReportZipError';
  }
}

@Injectable()
export class AnnualReportZipService {
  private readonly logger = new Logger(AnnualReportZipService.name);

  getDefaultMaxUncompressedBytes(): number {
    return Number(process.env.AR_ZIP_MAX_UNCOMPRESSED_BYTES ?? 500 * 1024 * 1024);
  }

  getDefaultMaxEntryBytes(): number {
    return Number(process.env.AR_ZIP_MAX_ENTRY_BYTES ?? 120 * 1024 * 1024);
  }

  getDefaultMaxEntries(): number {
    return Number(process.env.AR_ZIP_MAX_ENTRIES ?? 5000);
  }

  /**
   * Stream-based safe extraction: zip-slip checks, aggregate uncompressed size cap, manifest + iXBRL detection.
   */
  async extractSafe(zipBuffer: Buffer): Promise<SafeZipExtractResult> {
    const maxTotal = this.getDefaultMaxUncompressedBytes();
    const maxEntry = this.getDefaultMaxEntryBytes();
    const maxFiles = this.getDefaultMaxEntries();

    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'verifyiq-ar-'));

    let directory: unzipper.CentralDirectory;
    try {
      directory = await unzipper.Open.buffer(zipBuffer);
    } catch (e) {
      await this.safeRmDir(workDir);
      throw new AnnualReportZipError('Invalid or unreadable ZIP archive', 'invalid_zip');
    }

    if (directory.files.length > maxFiles) {
      await this.safeRmDir(workDir);
      throw new AnnualReportZipError(
        `Too many ZIP entries (${directory.files.length} > ${maxFiles})`,
        'zip_too_many_entries',
      );
    }

    let aggregateUncompressed = 0;
    const manifest: SafeZipExtractResult['manifest'] = [];
    const ixbrlCandidates: Array<{ pathInArchive: string; score: number }> = [];

    for (const entry of directory.files) {
      const entryPath = (entry as { path?: string }).path ?? '';
      if (!entryPath || entryPath.trim() === '') continue;

      const normalized = path.posix.normalize(entryPath.replace(/\\/g, '/'));
      if (normalized.startsWith('/') || normalized.includes('../')) {
        await this.safeRmDir(workDir);
        throw new AnnualReportZipError(`Unsafe ZIP path: ${entryPath}`, 'zip_slip');
      }

      const type = (entry as { type?: string }).type;
      const isDirectory = type === 'Directory';

      const rawSize = Number((entry as { uncompressedSize?: number }).uncompressedSize ?? 0);
      if (!isDirectory) {
        aggregateUncompressed += rawSize;
        if (aggregateUncompressed > maxTotal) {
          await this.safeRmDir(workDir);
          throw new AnnualReportZipError(
            'ZIP uncompressed size exceeds configured limit',
            'zip_uncompressed_too_large',
          );
        }
        if (rawSize > maxEntry) {
          await this.safeRmDir(workDir);
          throw new AnnualReportZipError(
            `ZIP entry too large: ${entryPath}`,
            'zip_entry_too_large',
          );
        }
      }

      const destPath = path.join(workDir, ...normalized.split('/'));
      const resolvedDest = path.resolve(destPath);
      const resolvedBase = path.resolve(workDir);
      if (resolvedDest !== resolvedBase && !resolvedDest.startsWith(resolvedBase + path.sep)) {
        await this.safeRmDir(workDir);
        throw new AnnualReportZipError(`Zip-slip resolved path outside work dir: ${entryPath}`, 'zip_slip');
      }

      let contentSha256: string | undefined;
      let isCandidateIxbrl = false;
      let ixScore = 0;

      if (!isDirectory) {
        await fs.mkdir(path.dirname(resolvedDest), { recursive: true });
        const fileEntry = entry as unzipper.File;
        const body = await fileEntry.buffer();
        if (body.length > maxEntry) {
          await this.safeRmDir(workDir);
          throw new AnnualReportZipError(`ZIP entry too large: ${entryPath}`, 'zip_entry_too_large');
        }
        contentSha256 = crypto.createHash('sha256').update(body).digest('hex');
        await fs.writeFile(resolvedDest, body);

        const lower = normalized.toLowerCase();
        if (lower.endsWith('.xhtml') || lower.endsWith('.html') || lower.endsWith('.htm')) {
          const probe = body.subarray(0, Math.min(body.length, 256 * 1024)).toString('utf8');
          ixScore = this.scoreIxbrlContent(probe, normalized);
          isCandidateIxbrl = ixScore > 0;
        }
        if (isCandidateIxbrl) {
          ixbrlCandidates.push({ pathInArchive: normalized, score: ixScore });
        }
      } else {
        await fs.mkdir(resolvedDest, { recursive: true });
      }

      manifest.push({
        pathInArchive: normalized,
        uncompressedSize: rawSize,
        isDirectory,
        contentSha256,
        isCandidateIxbrl,
      });
    }

    ixbrlCandidates.sort((a, b) => b.score - a.score);

    this.logger.debug(
      `Extracted ZIP to ${workDir}, entries=${manifest.length}, ixCandidates=${ixbrlCandidates.length}`,
    );

    return { workDir, manifest, ixbrlCandidates };
  }

  pickIxbrlPath(candidates: SafeZipExtractResult['ixbrlCandidates']): string | null {
    if (!candidates.length) return null;
    return candidates[0].pathInArchive;
  }

  resolvePath(workDir: string, pathInArchive: string): string {
    return path.join(workDir, ...path.posix.normalize(pathInArchive).split('/'));
  }

  async cleanupWorkDir(workDir: string): Promise<void> {
    await this.safeRmDir(workDir);
  }

  private scoreIxbrlContent(snippet: string, filePath: string): number {
    let score = 0;
    const s = snippet.toLowerCase();
    for (const m of IXBRL_MARKERS) {
      if (s.includes(m.toLowerCase())) score += 5;
    }
    const p = filePath.toLowerCase();
    if (p.includes('report') || p.includes('arsredovisning') || p.includes('annual')) score += 3;
    return score;
  }

  private async safeRmDir(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
