/** Single source for backend origin + /api/v1 (no trailing slash). */
export const API_V1_BASE_URL = (
  // In hosted environments, falling back to localhost makes browser calls fail with HTTP 0.
  // Prefer same-origin /api/v1 when NEXT_PUBLIC_API_BASE_URL is not set.
  process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1'
).replace(/\/+$/, '');
