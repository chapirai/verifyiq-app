import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload-intents')
  createUploadIntent(@Body() dto: CreateDocumentDto) {
    return this.documentsService.createUploadIntent(dto);
  }

  @Get()
  listDocuments() {
    return this.documentsService.listDocuments();
  }

  @Get(':id/download-intent')
  getDownloadIntent(@Param('id') id: string) {
    return this.documentsService.getDownloadIntent(id);
  }
}
