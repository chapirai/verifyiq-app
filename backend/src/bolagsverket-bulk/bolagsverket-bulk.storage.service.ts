import { Injectable } from '@nestjs/common';
import { Readable, PassThrough } from 'stream';
import { pipeline } from 'stream/promises';
import { createReadStream } from 'fs';
import { rm } from 'fs/promises';
import { basename, dirname } from 'path';
import { R2StorageService } from '../object-storage/r2-storage.service';
import { R2KeyBuilder } from '../object-storage/r2-key-builder';
import { ProviderDownloadService } from '../ingestion/provider-download.service';
import { ZipStreamService } from '../ingestion/zip-stream.service';
import { defaultZipEntrySelector } from '../ingestion/zip-entry-selector.util';
import { StreamChecksumTransform } from '../ingestion/stream-checksum.util';

@Injectable()
export class BolagsverketBulkStorageService {
  constructor(
    private readonly r2Storage: R2StorageService,
    private readonly keyBuilder: R2KeyBuilder,
    private readonly providerDownload: ProviderDownloadService,
    private readonly zipStream: ZipStreamService,
  ) {
  }

  async downloadAndArchiveWeeklyZip(sourceUrl: string): Promise<{
    zipSha256: string;
    txtSha256: string;
    zipObjectKey: string;
    txtObjectKey: string;
    zipSizeBytes: number;
    txtSizeBytes: number;
  }> {
    const download = await this.providerDownload.downloadToTempFile(sourceUrl, 'bolagsverket_bulkfil.zip');
    const now = new Date();
    const zipObjectKey = this.keyBuilder.bolagsverketBulkZip(now, 'file.zip');
    const zipReadStream = createReadStream(download.filePath);
    await this.r2Storage.putObjectStream(zipObjectKey, zipReadStream, undefined, 'application/zip');

    const { entryPath, stream: txtEntryStream } = await this.zipStream.openEntryStream(download.filePath, defaultZipEntrySelector);
    const txtFileName = basename(entryPath) || 'bulk.txt';
    const txtObjectKey = this.keyBuilder.bolagsverketBulkTxt(now, txtFileName);
    const txtChecksum = new StreamChecksumTransform('sha256');
    const txtPass = new PassThrough();
    const txtUpload = this.r2Storage.putObjectStream(txtObjectKey, txtPass, undefined, 'text/plain; charset=utf-8');
    await pipeline(txtEntryStream, txtChecksum, txtPass);
    await txtUpload;

    await rm(dirname(download.filePath), { recursive: true, force: true });

    return {
      zipSha256: download.sha256,
      txtSha256: txtChecksum.digestHex(),
      zipObjectKey,
      txtObjectKey,
      zipSizeBytes: download.bytes,
      txtSizeBytes: txtChecksum.totalBytes(),
    };
  }

  async getPresignedObjectUrl(objectKey: string, expiresInSeconds = 900): Promise<{ url: string; expiresInSeconds: number }> {
    return this.r2Storage.getPresignedObjectUrl(objectKey, expiresInSeconds);
  }

  async getObjectBuffer(objectKey: string): Promise<Buffer> {
    // This helper is only safe for small files; large ingestion should use getObjectStream.
    const chunks: Buffer[] = [];
    const stream = await this.r2Storage.getObjectStream(objectKey);
    return await new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async getObjectStream(objectKey: string): Promise<Readable> {
    return this.r2Storage.getObjectStream(objectKey);
  }
}

