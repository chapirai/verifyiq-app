import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { createWriteStream } from 'fs';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { StreamChecksumTransform } from './stream-checksum.util';

@Injectable()
export class ProviderDownloadService {
  constructor(private readonly http: HttpService) {}

  async downloadToTempFile(url: string, fileName = 'source.zip'): Promise<{ filePath: string; sha256: string; bytes: number }> {
    const dir = await mkdtemp(join(tmpdir(), 'verifyiq-ingestion-'));
    const filePath = join(dir, fileName);
    const response = await firstValueFrom(this.http.get(url, { responseType: 'stream' }));
    const checksum = new StreamChecksumTransform('sha256');
    await pipeline(response.data, checksum, createWriteStream(filePath));
    return { filePath, sha256: checksum.digestHex(), bytes: checksum.totalBytes() };
  }
}

