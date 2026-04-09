import { SectionHeader } from '@/components/section-header';

interface DashboardPlaceholderPageProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function DashboardPlaceholderPage({
  eyebrow,
  title,
  description,
}: DashboardPlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <SectionHeader eyebrow={eyebrow} title={title} description={description} />
      <section className="panel p-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          This module is active in the new Minimalist Modern shell and ready for feature wiring. The
          visual system, spacing, and typography are now centralized through shared styles and tokens.
        </p>
      </section>
    </div>
  );
}
