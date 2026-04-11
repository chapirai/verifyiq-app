import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import { z } from 'zod';

const arelleFactSchema = z.object({
  sequence_index: z.number(),
  context_ref: z.string().nullable().optional(),
  unit_ref: z.string().nullable().optional(),
  concept_qname: z.string(),
  value_text: z.string().nullable().optional(),
  value_numeric: z.number().nullable().optional(),
  decimals: z.number().nullable().optional(),
  precision_value: z.number().nullable().optional(),
  is_nil: z.boolean().optional(),
  footnotes: z.array(z.unknown()).optional(),
  dimensions: z.record(z.string(), z.string()).optional(),
  raw_json: z.record(z.string(), z.unknown()).optional(),
});

const arelleContextSchema = z.object({
  xbrl_context_id: z.string(),
  period_instant: z.string().nullable().optional(),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
  dimensions: z.record(z.string(), z.string()).optional(),
  raw_json: z.record(z.string(), z.unknown()).optional(),
});

const arelleUnitSchema = z.object({
  xbrl_unit_id: z.string(),
  measures: z.array(z.string()).optional(),
  raw_json: z.record(z.string(), z.unknown()).optional(),
});

const arelleLabelSchema = z.object({
  concept_qname: z.string(),
  lang: z.string().optional(),
  label_role: z.string().optional(),
  label_text: z.string(),
});

export const arelleExtractResultSchema = z.object({
  ok: z.literal(true),
  source_path: z.string().optional(),
  arelle_version: z.string().nullable().optional(),
  contexts: z.array(arelleContextSchema),
  units: z.array(arelleUnitSchema),
  facts: z.array(arelleFactSchema),
  labels: z.array(arelleLabelSchema),
});

export type ArelleExtractResult = z.infer<typeof arelleExtractResultSchema>;

const arelleErrorSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  message: z.string().optional(),
  hint: z.string().optional(),
});

@Injectable()
export class AnnualReportArelleService {
  private readonly logger = new Logger(AnnualReportArelleService.name);

  private pythonExecutable(): string {
    return process.env.ARELLE_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
  }

  private scriptPath(): string {
    if (process.env.ARELLE_EXTRACT_SCRIPT) {
      return path.resolve(process.env.ARELLE_EXTRACT_SCRIPT);
    }
    return path.resolve(process.cwd(), 'tools', 'ixbrl_arelle_extract.py');
  }

  /**
   * Run Arelle extractor subprocess; returns parsed JSON or throws.
   */
  async extractIxbrl(ixbrlAbsolutePath: string): Promise<ArelleExtractResult> {
    const py = this.pythonExecutable();
    const script = this.scriptPath();
    const timeoutMs = Number(process.env.ARELLE_EXTRACT_TIMEOUT_MS ?? 300_000);

    const stdout = await this.runSubprocess(py, [script, ixbrlAbsolutePath], timeoutMs);

    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      this.logger.error(`Arelle stdout not JSON (first 500 chars): ${stdout.slice(0, 500)}`);
      throw new Error('arelle_invalid_json_output');
    }

    const err = arelleErrorSchema.safeParse(parsed);
    if (err.success) {
      throw new Error(`arelle_failed:${err.data.error}${err.data.message ? `:${err.data.message}` : ''}`);
    }

    const ok = arelleExtractResultSchema.safeParse(parsed);
    if (!ok.success) {
      this.logger.warn(`Arelle output schema mismatch: ${ok.error.message}`);
      throw new Error('arelle_output_schema_mismatch');
    }
    return ok.data;
  }

  private runSubprocess(cmd: string, args: string[], timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        windowsHide: true,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      });
      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];
      let killed = false;
      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        reject(new Error('arelle_timeout'));
      }, timeoutMs);

      child.stdout.on('data', (c: Buffer) => chunks.push(c));
      child.stderr.on('data', (c: Buffer) => errChunks.push(c));
      child.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        const stderr = Buffer.concat(errChunks).toString('utf8').trim();
        if (stderr) {
          this.logger.debug(`Arelle stderr: ${stderr.slice(0, 2000)}`);
        }
        if (killed) return;
        if (code !== 0 && code !== null) {
          reject(new Error(`arelle_exit_${code}`));
          return;
        }
        if (signal) {
          reject(new Error(`arelle_signal_${signal}`));
          return;
        }
        resolve(Buffer.concat(chunks).toString('utf8').trim());
      });
    });
  }
}
