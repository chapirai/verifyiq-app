import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#FFFFFF',
        foreground: '#000000',
        muted: '#F5F5F5',
        'muted-foreground': '#525252',
        border: '#000000',
        'border-light': '#E5E5E5',
        card: '#FFFFFF',
        'card-foreground': '#000000',
      },
      fontFamily: {
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        body: ['var(--font-source-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      borderRadius: {
        none: '0px',
      },
      transitionDuration: {
        instant: '100ms',
      },
      maxWidth: {
        /* Editorial column: ~1152px (Tailwind 6xl) per Minimalist Monochrome */
        content: '72rem',
      },
      fontSize: {
        'display-hero': ['clamp(3rem,12vw,10rem)', { lineHeight: '0.95', letterSpacing: '-0.05em' }],
      },
    },
  },
  plugins: [],
};

export default config;
