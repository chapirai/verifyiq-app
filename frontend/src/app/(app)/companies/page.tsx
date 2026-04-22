'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { normalizeIdentitetsbeteckning } from '@/lib/org-number';
import type { CompanyListResponse } from '@/types/api';
import type { TargetList } from '@/types/target-lists';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';
import { Table } from '@/components/ui/Table';

const SORT_OPTIONS = [
  { value: 'updatedAt', label: 'Updated (default)' },
  { value: 'sourcing_rank', label: 'Sourcing rank (signals)' },
  { value: 'ownership_risk', label: 'Ownership risk (Phase 11)' },
  { value: 'legalName', label: 'Legal name' },
  { value: 'createdAt', label: 'Created' },
] as const;

const DEAL_MODE_OPTIONS = [
  { value: '', label: 'No deal mode' },
  { value: 'founder_exit', label: 'Founder exit' },
  { value: 'distressed', label: 'Distressed' },
  { value: 'roll_up', label: 'Roll-up' },
] as const;

function readListState(sp: URLSearchParams) {
  const pageRaw = Number(sp.get('page') ?? '1');
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const sortByRaw = sp.get('sort_by') ?? 'updatedAt';
  const sortBy = SORT_OPTIONS.some((o) => o.value === sortByRaw) ? sortByRaw : 'updatedAt';
  const hfr = sp.get('has_financial_reports');
  return {
    query: sp.get('q') ?? '',
    status: sp.get('status') ?? '',
    companyFormContains: sp.get('company_form_contains') ?? '',
    orgNumber: sp.get('org_number') ?? '',
    industryContains: sp.get('industry_contains') ?? '',
    countryCode: sp.get('country_code') ?? '',
    hasFinancialReports: hfr === 'true' ? 'true' : hfr === 'false' ? 'false' : '',
    officerRoleContains: sp.get('officer_role_contains') ?? '',
    dealMode: (sp.get('deal_mode') ?? '') as '' | 'founder_exit' | 'distressed' | 'roll_up',
    sortBy: sortBy as (typeof SORT_OPTIONS)[number]['value'],
    page,
  };
}

function listQueryStringFromState(s: ReturnType<typeof readListState>): string {
  const qs = new URLSearchParams({
    page: String(s.page),
    limit: '20',
    sort_by: s.sortBy,
    sort_dir: 'desc',
  });
  if (s.query.trim()) qs.set('q', s.query.trim());
  if (s.status) qs.set('status', s.status);
  if (s.companyFormContains.trim()) qs.set('company_form_contains', s.companyFormContains.trim());
  const digits = s.orgNumber.replace(/\D/g, '');
  if (digits.length >= 10) qs.set('org_number', digits);
  if (s.industryContains.trim()) qs.set('industry_contains', s.industryContains.trim());
  if (s.countryCode.trim().length === 2) qs.set('country_code', s.countryCode.trim().toUpperCase());
  if (s.hasFinancialReports === 'true') qs.set('has_financial_reports', 'true');
  if (s.hasFinancialReports === 'false') qs.set('has_financial_reports', 'false');
  if (s.officerRoleContains.trim()) qs.set('officer_role_contains', s.officerRoleContains.trim());
  if (s.dealMode) qs.set('deal_mode', s.dealMode);
  return qs.toString();
}

function CompaniesPageContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const spKey = sp.toString();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [companyFormContains, setCompanyFormContains] = useState('');
  const [orgNumber, setOrgNumber] = useState('');
  const [industryContains, setIndustryContains] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [hasFinancialReports, setHasFinancialReports] = useState<string>('');
  const [officerRoleContains, setOfficerRoleContains] = useState('');
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]['value']>('updatedAt');
  const [dealMode, setDealMode] = useState<'' | 'founder_exit' | 'distressed' | 'roll_up'>('');
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CompanyListResponse | null>(null);
  const [sla, setSla] = useState<{ p95_ms: number; target_ms: number; target_met_p95: boolean | null } | null>(null);

  const [lists, setLists] = useState<TargetList[]>([]);
  const [targetListId, setTargetListId] = useState('');
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(() => new Set());
  const [shortlistMsg, setShortlistMsg] = useState('');
  const [shortlistErr, setShortlistErr] = useState('');
  const [shortlistDealMode, setShortlistDealMode] = useState<'' | 'founder_exit' | 'distressed' | 'roll_up'>('');

  useEffect(() => {
    const p = new URLSearchParams(spKey);
    const s = readListState(p);
    setQuery(s.query);
    setStatus(s.status);
    setCompanyFormContains(s.companyFormContains);
    setOrgNumber(s.orgNumber);
    setIndustryContains(s.industryContains);
    setCountryCode(s.countryCode);
    setHasFinancialReports(s.hasFinancialReports);
    setOfficerRoleContains(s.officerRoleContains);
    setDealMode(s.dealMode);
    setSortBy(s.sortBy);
    setPage(s.page);
  }, [spKey]);

  useEffect(() => {
    void api
      .listTargetLists()
      .then((rows) => {
        setLists(rows);
        setTargetListId((cur) => {
          if (cur && rows.some((l) => l.id === cur)) return cur;
          return rows[0]?.id ?? '';
        });
      })
      .catch(() => undefined);
  }, []);

  const buildQsForPage = useCallback(
    (nextPage: number) => {
      const qs = new URLSearchParams({
        page: String(nextPage),
        limit: '20',
        sort_by: sortBy,
        sort_dir: 'desc',
      });
      if (query.trim()) qs.set('q', query.trim());
      if (status) qs.set('status', status);
      if (companyFormContains.trim()) qs.set('company_form_contains', companyFormContains.trim());
      const digits = orgNumber.replace(/\D/g, '');
      if (digits.length >= 10) qs.set('org_number', digits);
      if (industryContains.trim()) qs.set('industry_contains', industryContains.trim());
      if (countryCode.trim().length === 2) qs.set('country_code', countryCode.trim().toUpperCase());
      if (hasFinancialReports === 'true') qs.set('has_financial_reports', 'true');
      if (hasFinancialReports === 'false') qs.set('has_financial_reports', 'false');
      if (officerRoleContains.trim()) qs.set('officer_role_contains', officerRoleContains.trim());
      if (dealMode) qs.set('deal_mode', dealMode);
      return qs.toString();
    },
    [
      query,
      status,
      companyFormContains,
      orgNumber,
      industryContains,
      countryCode,
      hasFinancialReports,
      officerRoleContains,
      dealMode,
      sortBy,
    ],
  );

  useEffect(() => {
    const urlState = readListState(new URLSearchParams(spKey));
    setLoading(true);
    setError('');
    api
      .searchCompanies(listQueryStringFromState(urlState))
      .then(setResult)
      .catch((err: { message?: string }) => setError(err.message ?? 'Failed to fetch companies'))
      .finally(() => setLoading(false));
  }, [spKey]);

  useEffect(() => {
    let cancelled = false;
    void api
      .getSearchPerformance()
      .then((perf) => {
        if (cancelled) return;
        setSla({ p95_ms: perf.p95_ms, target_ms: perf.target_ms, target_met_p95: perf.target_met_p95 });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [spKey]);

  const applyToUrl = (nextPage: number) => {
    const href = `/companies?${buildQsForPage(nextPage)}` as Route;
    router.replace(href, { scroll: false });
  };

  const onSearch = () => {
    setPage(1);
    setSelectedOrgs(new Set());
    applyToUrl(1);
  };

  const pageOrgKeys = useMemo(() => (result?.data ?? []).map((c) => normalizeIdentitetsbeteckning(c.organisationNumber)), [result]);

  const toggleOrg = (org: string) => {
    setSelectedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(org)) next.delete(org);
      else next.add(org);
      return next;
    });
  };

  const toggleAllPage = () => {
    if (!pageOrgKeys.length) return;
    const allSelected = pageOrgKeys.every((o) => selectedOrgs.has(o));
    if (allSelected) {
      setSelectedOrgs((prev) => {
        const next = new Set(prev);
        for (const o of pageOrgKeys) next.delete(o);
        return next;
      });
    } else {
      setSelectedOrgs((prev) => {
        const next = new Set(prev);
        for (const o of pageOrgKeys) next.add(o);
        return next;
      });
    }
  };

  const addShortlist = async () => {
    setShortlistMsg('');
    setShortlistErr('');
    if (!targetListId) {
      setShortlistErr('Create a target list first (Lists page).');
      return;
    }
    const orgs = [...selectedOrgs];
    if (orgs.length === 0) {
      setShortlistErr('Select at least one company.');
      return;
    }
    try {
      const r = await api.addTargetListItemsBulk(targetListId, orgs, shortlistDealMode || undefined);
      setShortlistMsg(`Added ${r.added}, skipped ${r.skipped}.`);
      setSelectedOrgs(new Set());
    } catch (e: unknown) {
      setShortlistErr(e instanceof Error ? e.message : 'Bulk add failed');
    }
  };

  const allOnPageSelected = pageOrgKeys.length > 0 && pageOrgKeys.every((o) => selectedOrgs.has(o));

  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">Companies</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Discovery list uses <span className="font-mono text-foreground">GET /companies/search</span> with structured filters
        and optional <span className="font-mono text-foreground">sort_by=sourcing_rank</span> for signal-based ordering on the index row.
      </p>
      {sla ? (
        <div className="inline-flex items-center gap-2 border border-border-light px-3 py-2 text-xs">
          <span className="mono-label text-[10px] text-muted-foreground">Search SLA</span>
          <span className="font-mono">
            p95 {sla.p95_ms}ms / target {sla.target_ms}ms
          </span>
          <span className={sla.target_met_p95 ? 'text-emerald-700' : 'text-amber-700'}>
            {sla.target_met_p95 ? 'on-target' : 'needs tuning'}
          </span>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_160px_180px_180px_auto]">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name (q)" />
        <Input
          value={orgNumber}
          onChange={(e) => setOrgNumber(e.target.value)}
          placeholder="Exact org number (10 or 12 digits)"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="LIQUIDATION">LIQUIDATION</option>
          <option value="BANKRUPT">BANKRUPT</option>
          <option value="DISSOLVED">DISSOLVED</option>
        </Select>
        <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as (typeof SORT_OPTIONS)[number]['value'])}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select value={dealMode} onChange={(e) => setDealMode(e.target.value as '' | 'founder_exit' | 'distressed' | 'roll_up')}>
          {DEAL_MODE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Button onClick={onSearch}>Search</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          value={companyFormContains}
          onChange={(e) => setCompanyFormContains(e.target.value)}
          placeholder="Company form contains (e.g. Aktiebolag)"
        />
        <Input
          value={industryContains}
          onChange={(e) => setIndustryContains(e.target.value)}
          placeholder="Industry / activity text (business_description)"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Input
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
          placeholder="Country ISO2 (e.g. SE)"
          maxLength={2}
        />
        <Select value={hasFinancialReports} onChange={(e) => setHasFinancialReports(e.target.value)}>
          <option value="">Financial reports: any</option>
          <option value="true">Has FI report rows</option>
          <option value="false">No FI report rows</option>
        </Select>
        <Input
          value={officerRoleContains}
          onChange={(e) => setOfficerRoleContains(e.target.value)}
          placeholder="Officer JSON contains (e.g. VD)"
        />
      </div>
      {loading && !result ? <LoadingSkeleton lines={8} /> : null}
      {loading && result ? <p className="text-xs text-muted-foreground">Refreshing results… showing previous page until update completes.</p> : null}
      {!loading && error ? <ErrorState title="Search error" message={error} /> : null}
      {!loading && !error && result && result.data.length === 0 ? (
        <EmptyState title="No companies found" description="Try broader criteria or run a direct lookup." />
      ) : null}
      {!error && result && result.data.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 border-2 border-foreground p-3 md:flex-row md:flex-wrap md:items-end">
            <div className="flex flex-1 flex-col gap-1">
              <label className="mono-label text-[10px] text-muted-foreground">Shortlist (target list)</label>
              <Select value={targetListId} onChange={(e) => setTargetListId(e.target.value)}>
                {lists.length === 0 ? <option value="">No lists — create one under Lists</option> : null}
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" variant="secondary" className="min-h-10 text-[10px]" onClick={() => void addShortlist()}>
              Add selected ({selectedOrgs.size})
            </Button>
            <Select
              value={shortlistDealMode}
              onChange={(e) => setShortlistDealMode(e.target.value as '' | 'founder_exit' | 'distressed' | 'roll_up')}
              className="min-h-10"
            >
              <option value="">No shortlist mode tag</option>
              <option value="founder_exit">Tag: Founder exit</option>
              <option value="distressed">Tag: Distressed</option>
              <option value="roll_up">Tag: Roll-up</option>
            </Select>
            {shortlistMsg ? <p className="text-xs text-muted-foreground">{shortlistMsg}</p> : null}
            {shortlistErr ? <p className="text-xs text-destructive">{shortlistErr}</p> : null}
          </div>
          <Table>
            <thead>
              <tr>
                <th className="w-10">
                  <input type="checkbox" aria-label="Select all on page" checked={allOnPageSelected} onChange={toggleAllPage} />
                </th>
                <th>Name</th>
                <th>Org Number</th>
                <th>Form</th>
                <th>Status</th>
                <th>Ownership risk</th>
                <th>Deal score</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {result.data.map((company) => {
                const key = normalizeIdentitetsbeteckning(company.organisationNumber);
                return (
                  <tr key={company.id}>
                    <td>
                      <input type="checkbox" checked={selectedOrgs.has(key)} onChange={() => toggleOrg(key)} />
                    </td>
                    <td>{company.legalName}</td>
                    <td>{company.organisationNumber}</td>
                    <td className="max-w-[140px] truncate text-muted-foreground">{company.companyForm ?? '—'}</td>
                    <td>{company.status}</td>
                    <td>{company.ownershipRiskScore != null ? company.ownershipRiskScore.toFixed(1) : '—'}</td>
                    <td>{company.dealModeScore != null ? company.dealModeScore.toFixed(1) : '—'}</td>
                    <td>
                      <Link
                        href={`/companies/workspace/${key}`}
                        className="underline underline-offset-4"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      ) : null}
      {!loading && !error && result ? (
        <div className="flex items-center justify-between border-2 border-foreground p-3 text-sm">
          <p>
            Page {result.page} of {Math.max(1, Math.ceil(result.total / result.limit))}
          </p>
          {result.perf ? (
            <p className="font-mono text-xs text-muted-foreground">
              {result.perf.elapsed_ms}ms {result.perf.cache_hit ? '(cache)' : '(fresh)'}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="min-h-9 px-3 py-1 text-[10px]"
              disabled={page <= 1}
              onClick={() => {
                const p = page - 1;
                setPage(p);
                applyToUrl(p);
              }}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              className="min-h-9 px-3 py-1 text-[10px]"
              disabled={!result.has_next}
              onClick={() => {
                const p = page + 1;
                setPage(p);
                applyToUrl(p);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function CompaniesPage() {
  return (
    <Suspense fallback={<LoadingSkeleton lines={8} />}>
      <CompaniesPageContent />
    </Suspense>
  );
}
