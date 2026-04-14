import { SetMetadata } from '@nestjs/common';

export const REQUIRED_SCOPES_KEY = 'required_scopes';
export const RequiredScopes = (...scopes: string[]) => SetMetadata(REQUIRED_SCOPES_KEY, scopes);
