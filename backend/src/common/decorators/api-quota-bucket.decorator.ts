import { SetMetadata } from '@nestjs/common';
import { API_QUOTA_BUCKET_KEY } from '../constants/api-quota-metadata';

/** Daily Redis quota namespace; use `financial-api` to keep the legacy key prefix. */
export const ApiQuotaBucket = (bucket: string) => SetMetadata(API_QUOTA_BUCKET_KEY, bucket);
