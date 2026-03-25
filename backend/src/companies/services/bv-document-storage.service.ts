import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { firstValueFrom } from 'rxjs';
import * as Minio from 'minio';
import { BvStoredDocumentEntity } from '../entities/bv-stored-document.entity';

/** Pre-signed URL expiry in seconds (15 minutes). */
const PRESIGNED_URL_EXPIRY_SECONDS = 900;

@Injectable()
export class BvDocumentStorageService {
  private readonly logger = new Logger(BvDocumentStorageService.name);
  private readonly minioClient: Minio.Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(BvStoredDocumentEntity)
    private readonly docRepo: Repository<BvStoredDocumentEntity>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.get<string>('S3_BUCKET', 'verifyiq-documents');
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: this.configService.get<number>('MINIO_PORT', 9000),
      useSSL: this.configService.get<boolean>('MINIO_USE_SSL', false),
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
    } = params;

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
          fileName: `${documentIdSource ?? 'document'}.pdf`,
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
        fileName: `${documentIdSource ?? 'document'}.pdf`,
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
        fileName: `${documentIdSource ?? 'document'}.pdf`,
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

    // Build storage key
    const storageKey = `bolagsverket/${tenantId}/${organisationsnummer}/${documentIdSource ?? 'document'}-${documentYear ?? 'unknown'}.pdf`;
    const fileName = `${documentIdSource ?? 'document'}-${documentYear ?? ''}.pdf`;

    // Ensure bucket exists
    try {
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket, 'eu-west-1');
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
}
