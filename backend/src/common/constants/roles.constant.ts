export const APP_ROLES = ['admin', 'compliance', 'reviewer', 'analyst'] as const;

export type AppRole = (typeof APP_ROLES)[number];
