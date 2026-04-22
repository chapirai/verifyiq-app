import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';
import * as unzipper from 'unzipper';
import * as Minio from 'minio';

@Injectable()
export class BolagsverketBulkStorageService {
  private readonly minio: Minio.Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.bucket = this.config.get<string>('S3_BUCKET', 'verifyiq-documents');
    this.region = this.config.get<string>('MINIO_REGION', 'eu-west-1');
    this.minio = new Minio.Client({
      endPoint: this.config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: this.config.get<number>('MINIO_PORT', 9000),
      useSSL: String(this.config.get('MINIO_USE_SSL', 'false')).toLowerCase() === 'true',
      accessKey: this.config.get<string>('AWS_ACCESS_KEY_ID', 'minioadmin'),
      secretKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY', 'minioadmin'),
    });
  }

  private async ensureBucket(): Promise<void> {
    const exists = await this.minio.bucketExists(this.bucket);
    if (!exists) await this.minio.makeBucket(this.bucket, this.region);
  }

  private sha256Hex(buf: Buffer): string {
    return createHash('sha256').update(buf).digest('hex');
  }

  async downloadAndArchiveWeeklyZip(sourceUrl: string): Promise<{
    zipBuffer: Buffer;
    txtBuffer: Buffer;
    zipSha256: string;
    txtSha256: string;
    zipObjectKey: string;
    txtObjectKey: string;
  }> {
    const response = await firstValueFrom(this.http.get(sourceUrl, { responseType: 'arraybuffer' }));
    const zipBuffer = Buffer.from(response.data as ArrayBuffer);
    const zipSha256 = this.sha256Hex(zipBuffer);

    const dir = await unzipper.Open.buffer(zipBuffer);
    const txt = dir.files.find(f => f.type === 'File' && f.path.toLowerCase().endsWith('.txt'));
    if (!txt) throw new Error('Bulk ZIP does not contain TXT file');
    const txtBuffer = await txt.buffer();
    const txtSha256 = this.sha256Hex(txtBuffer);

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipObjectKey = `bolagsverket-bulk/${stamp}/bolagsverket_bulkfil.zip`;
    const txtObjectKey = `bolagsverket-bulk/${stamp}/${txt.path.split('/').pop() ?? 'bulk.txt'}`;

    await this.ensureBucket();
    await this.minio.putObject(this.bucket, zipObjectKey, zipBuffer, zipBuffer.length, {
      'Content-Type': 'application/zip',
    });
    await this.minio.putObject(this.bucket, txtObjectKey, txtBuffer, txtBuffer.length, {
      'Content-Type': 'text/plain; charset=utf-8',
    });

    return { zipBuffer, txtBuffer, zipSha256, txtSha256, zipObjectKey, txtObjectKey };
  }

  async getPresignedObjectUrl(objectKey: string, expiresInSeconds = 900): Promise<{ url: string; expiresInSeconds: number }> {
    const url = await this.minio.presignedGetObject(this.bucket, objectKey, expiresInSeconds);
    return { url, expiresInSeconds };
  }

  async getObjectBuffer(objectKey: string): Promise<Buffer> {
    const chunks: Buffer[] = [];
    const stream = await this.minio.getObject(this.bucket, objectKey);
    return await new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}

