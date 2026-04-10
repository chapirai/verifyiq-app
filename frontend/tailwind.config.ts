import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#f4f6fb',
        foreground: '#0f172a',
        card: '#ffffff',
        muted: '#f1f5f9',
        'muted-foreground': '#64748b',
        border: '#e5e7eb',
        primary: {
          DEFAULT: '#2563eb',
          foreground: '#ffffff',
        },
        accent: '#2563eb',
        'accent-secondary': '#3b82f6',
        destructive: '#dc2626',
      },
      borderRadius: {
        lg: '14px',
        xl: '20px',
        '2xl': '24px',
      },
      boxShadow: {
        card: '0 25px 50px -12px rgba(15, 23, 42, 0.08), 0 12px 24px -10px rgba(15, 23, 42, 0.05)',
        soft: '0 4px 14px rgba(15, 23, 42, 0.06)',
        primary: '0 8px 24px rgba(37, 99, 235, 0.22)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
