interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
}

export function SectionHeader({ eyebrow, title, description }: SectionHeaderProps) {
  return (
    <div>
      <p className="text-sm text-slate-400">{eyebrow}</p>
      <h1 className="text-3xl font-semibold">{title}</h1>
      {description ? <p className="mt-3 max-w-3xl text-slate-300">{description}</p> : null}
    </div>
  );
}
