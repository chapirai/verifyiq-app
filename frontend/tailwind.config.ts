import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#FAFAFA',
        foreground: '#0F172A',
        card: '#FFFFFF',
        muted: '#F1F5F9',
        'muted-foreground': '#64748B',
        border: '#E2E8F0',
        accent: '#0052FF',
        'accent-secondary': '#4D7CFF',
      },
      boxShadow: {
        soft: '0 4px 14px rgba(15, 23, 42, 0.08)',
        accent: '0 4px 14px rgba(0,82,255,0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
