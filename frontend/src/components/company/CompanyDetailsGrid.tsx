interface DetailItemProps {
  label: string;
  value?: string | null;
}

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 text-sm font-medium text-foreground">{value ?? '—'}</dd>
    </div>
  );
}

interface CompanyDetailsGridProps {
  orgNumber?: string | null;
  registeredAt?: string | null;
  companyForm?: string | null;
  countryCode?: string | null;
  businessDescription?: string | null;
}

export function CompanyDetailsGrid({
  orgNumber,
  registeredAt,
  companyForm,
  countryCode,
  businessDescription,
}: CompanyDetailsGridProps) {
  const formattedDate = registeredAt ? new Date(registeredAt).toLocaleDateString('sv-SE') : null;

  return (
    <div className="panel p-6 md:p-8">
      <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Company details
      </h3>
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <DetailItem label="Organisation number" value={orgNumber} />
        <DetailItem label="Registration date" value={formattedDate} />
        <DetailItem label="Company form" value={companyForm} />
        <DetailItem label="Country" value={countryCode} />
        {businessDescription && (
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Business description
            </dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-foreground">{businessDescription}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
