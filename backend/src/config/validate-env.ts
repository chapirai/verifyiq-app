import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  PG_HOST: z.string().min(1),
  PG_PORT: z.coerce.number().int().positive(),
  PG_DBNAME: z.string().min(1),
  PG_USER: z.string().min(1),
  PG_PASSWORD: z.string().min(1),
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive(),
  REDIS_PASSWORD: z.string().default(''),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  INTEGRATION_TOKEN_ENCRYPTION_KEY: z.string().min(16).optional(),
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive(),
  MINIO_USE_SSL: z.enum(['true', 'false']).or(z.boolean().transform(v => (v ? 'true' : 'false'))).default('false'),
  MINIO_ROOT_USER: z.string().min(1),
  MINIO_ROOT_PASSWORD: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  BV_CLIENT_ID: z.string().min(1),
  BV_CLIENT_SECRET: z.string().min(1),
  BV_HVD_CLIENT_ID: z.string().min(1).optional(),
  BV_HVD_CLIENT_SECRET: z.string().min(1).optional(),
  BV_HVD_BASE_URL: z.string().url().optional(),
  BV_HVD_TOKEN_URL: z.string().url().optional(),
  BV_HVD_REVOKE_URL: z.string().url().optional(),
  BV_HVD_SCOPES: z.string().min(1).optional(),
  BV_HVD_DOCUMENT_PATH: z.string().min(1).optional(),
  BV_FORETAGSINFO_BASE_URL: z.string().url().optional(),
  BV_FORETAGSINFO_CLIENT_ID: z.string().min(1).optional(),
  BV_FORETAGSINFO_CLIENT_SECRET: z.string().min(1).optional(),
  BV_FORETAGSINFO_TOKEN_URL: z.string().url().optional(),
  BV_FORETAGSINFO_SCOPES: z.string().min(1).optional(),
  BV_FORETAGSINFO_USE_OAUTH: z.enum(['true', 'false']).optional(),
  BV_FORETAGSINFO_AUTH_HEADER: z.string().min(1).optional(),
  BV_FORETAGSINFO_AUTH_VALUE: z.string().min(1).optional(),
  BV_FORETAGSINFO_BEARER_TOKEN: z.string().min(1).optional(),
  BV_FORETAGSINFO_AUTH_TOKEN: z.string().min(1).optional(),
  BV_FORETAGSINFO_TOKEN: z.string().min(1).optional(),
  API_BASE_URL: z.string().url(),
  FRONTEND_URL: z.string().url().optional(),
  FRONTEND_URLS: z
    .string()
    .optional()
    .refine(
      value =>
        !value ||
        value
          .split(',')
          .map(origin => origin.trim())
          .filter(Boolean)
          .every(origin => {
            try {
              new URL(origin);
              return true;
            } catch {
              return false;
            }
          }),
      { message: 'FRONTEND_URLS must be a comma-separated list of valid URLs' },
    ),
});

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const errors = Object.entries(flattened)
      .map(([key, value]) => `${key}: ${value?.join(', ')}`)
      .join('; ');

    throw new Error(`Invalid environment configuration: ${errors}`);
  }

  return parsed.data;
}
