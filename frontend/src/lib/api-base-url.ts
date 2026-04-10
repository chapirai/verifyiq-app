/** Single source for backend origin + /api/v1 (no trailing slash). */
export const API_V1_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1'
).replace(/\/+$/, '');
