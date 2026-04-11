import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { firstValueFrom } from 'rxjs';
import * as Minio from 'minio';
import { BvStoredDocumentEntity } from '../entities/bv-stored-document.entity';

/** Pre-signed URL expiry in seconds (15 minutes). */
const PRESIGNED_URL_EXPIRY_SECONDS = 900;

function storageExtensionFromHints(contentType?: string, upstreamFileName?: string): string {
  const fn = (upstreamFileName ?? '').toLowerCase();
  if (fn.endsWith('.zip')) return '.zip';
  if (fn.endsWith('.pdf')) return '.pdf';
  if (fn.endsWith('.xhtml') || fn.endsWith('.html')) return '.xhtml';
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('zip')) return '.zip';
  if (ct.includes('pdf')) return '.pdf';
  return '.bin';
}

@Injectable()
export class BvDocumentStorageService {
  private readonly logger = new Logger(BvDocumentStorageService.name);
  private readonly minioClient: Minio.Client;
  private readonly bucket: string;

  private readonly region: string;

  constructor(
    @InjectRepository(BvStoredDocumentEntity)
    private readonly docRepo: Repository<BvStoredDocumentEntity>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.get<string>('S3_BUCKET', 'verifyiq-documents');
    this.region = this.configService.get<string>('MINIO_REGION', 'eu-west-1');
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: this.configService.get<number>('MINIO_PORT', 9000),
      useSSL: this.configService.get<string>('MINIO_USE_SSL', 'false').toLowerCase() === 'true',
      accessKey: this.configService.get<string>('AWS_ACCESS_KEY_ID', 'minioadmin'),
      secretKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', 'minioadmin'),
    });
  }

  async storeDocument(params: {
    tenantId: string;
    organisationsnummer: string;
    organisationId?: string;
    documentIdSource?: string;
    documentType?: string;
    documentYear?: string;
    sourceUrl?: string;
    contentType?: string;
    fileBuffer?: Buffer;
    /** Original filename from upstream (e.g. HVD Content-Disposition) — drives .zip vs .pdf in MinIO key */
    upstreamFileName?: string;
  }): Promise<BvStoredDocumentEntity> {
    const {
      tenantId,
      organisationsnummer,
      organisationId,
      documentIdSource,
      documentType,
      documentYear,
      sourceUrl,
      contentType = 'application/pdf',
      upstreamFileName,
    } = params;

    const ext = storageExtensionFromHints(contentType, upstreamFileName);
    const baseName =
      (documentIdSource ?? 'document') + (documentYear ? `-${documentYear}` : '');

    let fileBuffer = params.fileBuffer;

    // Download if no buffer provided but URL is available
    if (!fileBuffer && sourceUrl) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(sourceUrl, { responseType: 'arraybuffer' }),
        );
        fileBuffer = Buffer.from(response.data as ArrayBuffer);
      } catch (err) {
        this.logger.warn(`Failed to download document from ${sourceUrl}: ${err}`);
        const entity = this.docRepo.create({
          tenantId,
          organisationsnummer,
          organisationId,
          documentIdSource,
          documentType,
          documentYear,
          fileName: `${baseName}${ext}`,
          contentType,
          sourceUrl,
          storageBucket: this.bucket,
          storageKey: '',
          downloadStatus: 'failed',
          errorMessage: String(err),
        });
        return this.docRepo.save(entity);
      }
    }

    if (!fileBuffer) {
      const entity = this.docRepo.create({
        tenantId,
        organisationsnummer,
        organisationId,
        documentIdSource,
        documentType,
        documentYear,
        fileName: `${baseName}${ext}`,
        contentType,
        sourceUrl,
        storageBucket: this.bucket,
        storageKey: '',
        downloadStatus: 'skipped',
        errorMessage: 'No file buffer or download URL available',
      });
      return this.docRepo.save(entity);
    }

    // Checksum for dedup
    const checksum = createHash('sha256').update(fileBuffer).digest('hex');

    // Check for existing document with same checksum
    const existing = await this.docRepo.findOne({
      where: { tenantId, organisationsnummer, checksumSha256: checksum },
    });
    if (existing) {
      this.logger.debug(`Duplicate document detected (checksum: ${checksum})`);
      const dup = this.docRepo.create({
        tenantId,
        organisationsnummer,
        organisationId,
        documentIdSource,
        documentType,
        documentYear,
        fileName: upstreamFileName?.trim() || `${baseName}${ext}`,
        contentType,
        sourceUrl,
        storageBucket: this.bucket,
        storageKey: existing.storageKey,
        checksumSha256: checksum,
        isDuplicate: true,
        sizeBytes: fileBuffer.length,
        downloadStatus: 'skipped',
      });
      return this.docRepo.save(dup);
    }

    // Build storage key – use UUID segment when source ID or year are unavailable
    // to prevent collisions between documents with missing metadata.
    const docId = documentIdSource ?? randomUUID();
    const yearSegment = documentYear ?? randomUUID().slice(0, 8);
    const storageKey = `bolagsverket/${tenantId}/${organisationsnummer}/${docId}-${yearSegment}${ext}`;
    const fileName =
      upstreamFileName?.trim() || `${documentIdSource ?? 'document'}-${documentYear ?? 'file'}${ext}`;

    // Ensure bucket exists
    try {
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket, this.region);
      }
    } catch (err) {
      this.logger.warn(`Could not check/create MinIO bucket: ${err}`);
    }

    // Upload to MinIO
    try {
      await this.minioClient.putObject(this.bucket, storageKey, fileBuffer, fileBuffer.length, {
        'Content-Type': contentType,
      });
    } catch (err) {
      this.logger.error(`Failed to upload to MinIO: ${err}`);
      const entity = this.docRepo.create({
        tenantId,
        organisationsnummer,
        organisationId,
        documentIdSource,
        documentType,
        documentYear,
        fileName,
        contentType,
        sourceUrl,
        storageBucket: this.bucket,
        storageKey,
        checksumSha256: checksum,
        sizeBytes: fileBuffer.length,
        downloadStatus: 'failed',
        errorMessage: String(err),
      });
      return this.docRepo.save(entity);
    }

    const entity = this.docRepo.create({
      tenantId,
      organisationsnummer,
      organisationId,
      documentIdSource,
      documentType,
      documentYear,
      fileName,
      contentType,
      sourceUrl,
      storageBucket: this.bucket,
      storageKey,
      checksumSha256: checksum,
      sizeBytes: fileBuffer.length,
      isDuplicate: false,
      downloadStatus: 'downloaded',
      downloadedAt: new Date(),
    });
    return this.docRepo.save(entity);
  }

  async listStoredDocuments(
    tenantId: string,
    organisationsnummer: string,
  ): Promise<BvStoredDocumentEntity[]> {
    return this.docRepo.find({
      where: { tenantId, organisationsnummer },
      order: { createdAt: 'DESC' },
    });
  }

  async getDownloadUrl(id: string): Promise<{ url: string; expiresInSeconds: number }> {
    const doc = await this.docRepo.findOneByOrFail({ id });
    const url = await this.minioClient.presignedGetObject(
      doc.storageBucket,
      doc.storageKey,
      PRESIGNED_URL_EXPIRY_SECONDS,
    );
    return { url, expiresInSeconds: PRESIGNED_URL_EXPIRY_SECONDS };
  }

  /** Full object bytes (e.g. annual report ZIP in object storage). */
  async getObjectBuffer(storageBucket: string, storageKey: string): Promise<Buffer> {
    const chunks: Buffer[] = [];
    const stream = await this.minioClient.getObject(storageBucket, storageKey);
    return await new Promise((resolve, reject) => {
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}
