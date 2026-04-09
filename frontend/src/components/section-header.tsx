interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
}

export function SectionHeader({ eyebrow, title, description }: SectionHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="section-badge">
        <span className="section-badge-dot" />
        <span className="section-badge-text">{eyebrow}</span>
      </div>
      <h1 className="text-4xl leading-tight" style={{ fontFamily: 'var(--font-calistoga), Georgia, serif' }}>
        {title}
      </h1>
      {description ? <p className="max-w-3xl text-[15px] text-muted-foreground">{description}</p> : null}
    </div>
  );
}
