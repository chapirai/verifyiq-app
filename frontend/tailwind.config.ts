import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0b1020',
        card: '#121936',
        muted: '#90a0c0',
        border: '#24304f',
        accent: '#4f8cff',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
