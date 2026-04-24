import { createHash } from 'crypto';

export function rawRecordHash(rawLine: string): string {
  return createHash('sha256').update(rawLine).digest('hex');
}

