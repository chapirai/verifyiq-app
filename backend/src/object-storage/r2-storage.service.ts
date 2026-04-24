import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';

@Injectable()
export class R2StorageService {
  private readonly minio: Minio.Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('R2_BUCKET_NAME', this.config.get<string>('S3_BUCKET', 'verifyiq-documents'));
    this.minio = new Minio.Client({
      endPoint: this.config.get<string>('R2_ENDPOINT', this.config.get<string>('MINIO_ENDPOINT', 'localhost')),
      port: this.config.get<number>('MINIO_PORT', 9000),
      useSSL: String(this.config.get('MINIO_USE_SSL', 'true')).toLowerCase() === 'true',
      accessKey: this.config.get<string>('R2_ACCESS_KEY_ID', this.config.get<string>('AWS_ACCESS_KEY_ID', '')),
      secretKey: this.config.get<string>('R2_SECRET_ACCESS_KEY', this.config.get<string>('AWS_SECRET_ACCESS_KEY', '')),
    });
  }

  private async ensureBucket(): Promise<void> {
    const exists = await this.minio.bucketExists(this.bucket);
    if (!exists) await this.minio.makeBucket(this.bucket, 'auto');
  }

  async putObjectStream(objectKey: string, stream: Readable, size?: number, contentType?: string): Promise<void> {
    await this.ensureBucket();
    await this.minio.putObject(this.bucket, objectKey, stream, size, contentType ? { 'Content-Type': contentType } : undefined);
  }

  async getObjectStream(objectKey: string): Promise<Readable> {
    return (await this.minio.getObject(this.bucket, objectKey)) as Readable;
  }

  async getPresignedObjectUrl(objectKey: string, expiresInSeconds = 900): Promise<{ url: string; expiresInSeconds: number }> {
    const url = await this.minio.presignedGetObject(this.bucket, objectKey, expiresInSeconds);
    return { url, expiresInSeconds };
  }
}

