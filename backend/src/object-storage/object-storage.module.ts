import { Module } from '@nestjs/common';
import { R2StorageService } from './r2-storage.service';
import { R2KeyBuilder } from './r2-key-builder';

@Module({
  providers: [R2StorageService, R2KeyBuilder],
  exports: [R2StorageService, R2KeyBuilder],
})
export class ObjectStorageModule {}

