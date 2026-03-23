import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentEntity } from './document.entity';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentsRepo: Repository<DocumentEntity>,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async createUploadIntent(dto: CreateDocumentDto, actorUserId?: string) {
    const bucket = this.configService.get<string>('S3_BUCKET', 'verifyiq-documents');
    const storageKey = `${dto.companyId ?? dto.partyId ?? 'misc'}/${randomUUID()}-${dto.fileName}`;
    const entity = this.documentsRepo.create({
      tenantId: '00000000-0000-0000-0000-000000000001',
      partyId: dto.partyId ?? null,
      companyId: dto.companyId ?? null,
      storageBucket: bucket,
      storageKey,
      fileName: dto.fileName,
      contentType: dto.contentType ?? null,
      uploadedByUserId: actorUserId ?? null,
    });
    const saved = await this.documentsRepo.save(entity);
    await this.auditService.log({
      tenantId: '00000000-0000-0000-0000-000000000001',
      actorId: actorUserId ?? null,
      action: 'document.upload_intent.created',
      resourceType: 'document',
      resourceId: saved.id,
      metadata: dto,
    });
    return {
      document: saved,
      uploadUrl: `/api/v1/documents/${saved.id}/upload`,
      method: 'PUT',
      headers: {
        'content-type': dto.contentType ?? 'application/octet-stream',
      },
    };
  }

  listDocuments() {
    return this.documentsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getDownloadIntent(id: string) {
    const document = await this.documentsRepo.findOneByOrFail({ id });
    return {
      document,
      downloadUrl: `/api/v1/documents/${id}/download`,
      expiresInSeconds: 900,
    };
  }
}
