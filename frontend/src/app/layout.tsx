import type { Metadata } from 'next';
import { JetBrains_Mono, Playfair_Display, Source_Serif_4 } from 'next/font/google';
import { siteSeo } from '@/content/landing';
import '../styles/globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '500', '600', '700'],
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  weight: ['400', '500', '600', '700'],
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: siteSeo.title,
  description: siteSeo.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${playfair.variable} ${sourceSerif.variable} ${jetbrains.variable} min-mono-canvas bg-background text-foreground`}
      >
        <a
          href="#main-content"
          className="absolute left-4 top-4 z-[100] -translate-y-20 border-2 border-foreground bg-background px-4 py-2 font-mono text-xs uppercase tracking-widest text-foreground transition-none focus:translate-y-0 focus-visible:translate-y-0"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
