interface DetailItemProps {
  label: string;
  value?: string | null;
}

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-white">{value ?? '—'}</dd>
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
  const formattedDate = registeredAt
    ? new Date(registeredAt).toLocaleDateString('sv-SE')
    : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">
        Company Details
      </h2>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailItem label="Organisation Number" value={orgNumber} />
        <DetailItem label="Registration Date" value={formattedDate} />
        <DetailItem label="Company Form" value={companyForm} />
        <DetailItem label="Country" value={countryCode} />
        {businessDescription && (
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs font-medium uppercase tracking-widest text-slate-500">
              Business Description
            </dt>
            <dd className="mt-1 text-sm text-white">{businessDescription}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
