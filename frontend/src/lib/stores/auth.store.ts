'use client';

import { create } from 'zustand';

export interface AuthUser {
  id?: string;
  email?: string;
  role?: string;
  tenantId?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  hydrate: () => void;
  setSession: (payload: { accessToken: string; refreshToken: string; user?: AuthUser | null }) => void;
  clearSession: () => void;
}

function safeRead(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,

  hydrate: () => {
    const accessToken = safeRead('verifyiq_access_token');
    const refreshToken = safeRead('verifyiq_refresh_token');
    const rawUser = safeRead('verifyiq_user');
    set({
      accessToken,
      refreshToken,
      user: rawUser ? JSON.parse(rawUser) : null,
      isAuthenticated: Boolean(accessToken),
    });
  },

  setSession: ({ accessToken, refreshToken, user }) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('verifyiq_access_token', accessToken);
      localStorage.setItem('verifyiq_refresh_token', refreshToken);
      localStorage.setItem('verifyiq_user', JSON.stringify(user ?? null));
    }
    set({
      accessToken,
      refreshToken,
      user: user ?? null,
      isAuthenticated: true,
    });
  },

  clearSession: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('verifyiq_access_token');
      localStorage.removeItem('verifyiq_refresh_token');
      localStorage.removeItem('verifyiq_user');
    }
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },
}));
