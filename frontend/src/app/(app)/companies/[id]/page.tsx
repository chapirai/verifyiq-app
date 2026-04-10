'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ErrorState, LoadingSkeleton } from '@/components/ui/StateBlocks';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { fiClient, hvdClient } from '@/lib/source-clients';
import { Badge } from '@/components/ui/Badge';
import type { SourceFetchState } from '@/types/source-data';

export default function CompanyDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [orgNumber, setOrgNumber] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'hvd' | 'fi' | 'reports' | 'cases' | 'capital' | 'engagements'>('overview');
  const [hvdOrganisation, setHvdOrganisation] = useState<SourceFetchState<Record<string, unknown>>>({ data: null, error: null, ok: false });
  const [hvdDocuments, setHvdDocuments] = useState<SourceFetchState<Record<string, unknown>>>({ data: null, error: null, ok: false });
  const [fiOrganisation, setFiOrganisation] = useState<SourceFetchState<Record<string, unknown>>>({ data: null, error: null, ok: false });
  const [fiCases, setFiCases] = useState<SourceFetchState<Record<string, unknown>>>({ data: null, error: null, ok: false });
  const [fiCapital, setFiCapital] = useState<SourceFetchState<Record<string, unknown>>>({ data: null, error: null, ok: false });
  const [fiEngagements, setFiEngagements] = useState<SourceFetchState<Record<string, unknown>>>({ data: null, error: null, ok: false });
  const [fiFinancial, setFiFinancial] = useState<SourceFetchState<Record<string, unknown>>>({ data: null, error: null, ok: false });
  const [downloadState, setDownloadState] = useState<string>('');
  const [snapshots, setSnapshots] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    api.getCompany(params.id)
      .then((response) => setData(response as Record<string, unknown>))
      .catch((err: { message?: string }) => setError(err.message ?? 'Failed to load company'));
  }, [params.id]);

  useEffect(() => {
    if (!data) return;
    const companyPayload = (data.company as Record<string, unknown> | undefined) ?? data;
    const number = String(companyPayload.organisationsnummer ?? companyPayload.organizationNumber ?? '');
    if (!number) return;
    Promise.all([
      api.getCompanySnapshots(number, 10).catch(() => ({ data: [] })),
    ]).then(([history]) => {
      setSnapshots(((history as { data?: Array<Record<string, unknown>> }).data) ?? []);
    });

    void loadSourceData(number);
  }, [data]);

  const loadSourceData = async (number: string) => {
    const fiCategories = [
      'VERKSAMHETSBESKRIVNING',
      'ORGANISATIONSDATUM',
      'SAMTLIGA_ORGANISATIONSNAMN',
      'FUNKTIONARER',
      'RAKENSKAPSAR',
      'FINANSIELLA_RAPPORTER',
      'ORGANISATIONSENGAGEMANG',
    ];
    const results = await Promise.allSettled([
      hvdClient.hvdGetOrganisation({ identitetsbeteckning: number }),
      hvdClient.hvdGetDocumentList({ identitetsbeteckning: number }),
      fiClient.fiGetOrganisation({ identitetsbeteckning: number, informationCategories: fiCategories }),
      fiClient.fiGetCases({ organisationIdentitetsbeteckning: number }),
      fiClient.fiGetShareCapitalChanges({ identitetsbeteckning: number }),
      fiClient.fiGetOrganisationEngagements({ identitetsbeteckning: number, paginering: { sida: 1, antalPerSida: 20 } }),
      fiClient.fiGetFinancialReports({ identitetsbeteckning: number }),
    ]);

    const mapState = (result: PromiseSettledResult<Record<string, unknown>>): SourceFetchState<Record<string, unknown>> =>
      result.status === 'fulfilled'
        ? { data: result.value, error: null, ok: true }
        : { data: null, error: result.reason instanceof Error ? result.reason.message : 'Source request failed', ok: false };

    setHvdOrganisation(mapState(results[0] as PromiseSettledResult<Record<string, unknown>>));
    setHvdDocuments(mapState(results[1] as PromiseSettledResult<Record<string, unknown>>));
    setFiOrganisation(mapState(results[2] as PromiseSettledResult<Record<string, unknown>>));
    setFiCases(mapState(results[3] as PromiseSettledResult<Record<string, unknown>>));
    setFiCapital(mapState(results[4] as PromiseSettledResult<Record<string, unknown>>));
    setFiEngagements(mapState(results[5] as PromiseSettledResult<Record<string, unknown>>));
    setFiFinancial(mapState(results[6] as PromiseSettledResult<Record<string, unknown>>));
  };

  const renderKeyValues = (payload: Record<string, unknown> | null, emptyMessage: string) => {
    if (!payload) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
    const entries = Object.entries(payload).slice(0, 30);
    return (
      <dl className="grid gap-4 md:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key} className="border-b border-foreground/20 pb-2">
            <dt className="mono-label text-[10px]">{key}</dt>
            <dd className="mt-1 break-words text-sm">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
          </div>
        ))}
      </dl>
    );
  };

  const getDocumentRows = (payload: Record<string, unknown> | null): Array<Record<string, unknown>> => {
    if (!payload) return [];
    const explicit = payload.dokument;
    if (Array.isArray(explicit)) return explicit as Array<Record<string, unknown>>;
    const values = Object.values(payload);
    const firstArray = values.find((value) => Array.isArray(value));
    return Array.isArray(firstArray) ? (firstArray as Array<Record<string, unknown>>) : [];
  };

  if (error) {
    return (
      <section className="space-y-6">
        <ErrorState title="Company detail endpoint unavailable" message={`${error}. Use direct lookup by organization number.`} />
        <div className="flex gap-3 border-2 border-foreground p-4">
          <Input value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)} placeholder="10 or 12 digit organization number" />
          <Button
            onClick={async () => {
              setError('');
              const response = await api.lookupCompany(orgNumber);
              const companyData = response as Record<string, unknown>;
              setData(companyData);
              const number = String((companyData.company as { organisationsnummer?: string; organizationNumber?: string } | undefined)?.organisationsnummer
                ?? (companyData.company as { organizationNumber?: string } | undefined)?.organizationNumber
                ?? orgNumber);
              if (number) {
                const [history] = await Promise.all([api.getCompanySnapshots(number, 10).catch(() => ({ data: [] }))]);
                const rows = (history as { data?: Array<Record<string, unknown>> }).data ?? [];
                setSnapshots(rows);
                await loadSourceData(number);
              }
            }}
          >
            Lookup
          </Button>
        </div>
      </section>
    );
  }
  if (!data) return <LoadingSkeleton lines={10} />;

  const companyPayload = (data.company as Record<string, unknown> | undefined) ?? data;
  const metadata = (data.metadata as Record<string, unknown> | undefined) ?? {};
  const entries = Object.entries(companyPayload).slice(0, 20);
  const docs = getDocumentRows(hvdDocuments.data);
  return (
    <section className="space-y-6">
      <h1 className="font-display text-5xl">Company details & financial analysis</h1>
      <div className="flex flex-wrap gap-2">
        <button className={`border px-3 py-2 text-xs ${activeTab === 'overview' ? 'bg-foreground text-background' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`border px-3 py-2 text-xs ${activeTab === 'hvd' ? 'bg-foreground text-background' : ''}`} onClick={() => setActiveTab('hvd')}>HVD Data</button>
        <button className={`border px-3 py-2 text-xs ${activeTab === 'fi' ? 'bg-foreground text-background' : ''}`} onClick={() => setActiveTab('fi')}>FI v4 Data</button>
        <button className={`border px-3 py-2 text-xs ${activeTab === 'reports' ? 'bg-foreground text-background' : ''}`} onClick={() => setActiveTab('reports')}>Annual Reports</button>
        <button className={`border px-3 py-2 text-xs ${activeTab === 'cases' ? 'bg-foreground text-background' : ''}`} onClick={() => setActiveTab('cases')}>Cases</button>
        <button className={`border px-3 py-2 text-xs ${activeTab === 'capital' ? 'bg-foreground text-background' : ''}`} onClick={() => setActiveTab('capital')}>Share Capital</button>
        <button className={`border px-3 py-2 text-xs ${activeTab === 'engagements' ? 'bg-foreground text-background' : ''}`} onClick={() => setActiveTab('engagements')}>Engagements</button>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <article className="border-2 border-foreground p-4"><p className="mono-label text-[10px]">Data source</p><p className="mt-2 text-sm">{String(metadata.source ?? '-')}</p></article>
        <article className="border-2 border-foreground p-4"><p className="mono-label text-[10px]">Freshness</p><p className="mt-2 text-sm">{String(metadata.freshness ?? '-')}</p></article>
        <article className="border-2 border-foreground p-4"><p className="mono-label text-[10px]">Policy</p><p className="mt-2 text-sm">{String(metadata.policy_decision ?? '-')}</p></article>
        <article className="border-2 border-foreground p-4"><p className="mono-label text-[10px]">Failure state</p><p className="mt-2 text-sm">{String(metadata.failure_state ?? 'none')}</p></article>
      </div>
      {activeTab === 'overview' ? (
        <div className="space-y-6">
          <div className="border-2 border-foreground p-6">
            <p className="mono-label text-[10px]">Company summary</p>
            <dl className="grid gap-4 md:grid-cols-2">
              {entries.map(([key, value]) => (
                <div key={key} className="border-b border-foreground/20 pb-2">
                  <dt className="mono-label text-[10px]">{key}</dt>
                  <dd className="mt-1 break-words text-sm">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="border-2 border-foreground p-6">
            <p className="mono-label text-[10px]">Fetch history</p>
            {snapshots.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm">
                {snapshots.map((s, idx) => (
                  <li key={idx}>- {String(s['fetchedAt'] ?? s['fetched_at'] ?? 'n/a')} / {String(s['fetchStatus'] ?? s['status'] ?? 'unknown')}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No snapshot history available.</p>
            )}
          </div>
        </div>
      ) : null}
      {activeTab === 'hvd' ? (
        <div className="border-2 border-foreground p-6">
          <div className="mb-4 flex items-center gap-2"><Badge>HVD</Badge>{hvdOrganisation.ok ? <Badge>ok</Badge> : <Badge>error</Badge>}</div>
          {hvdOrganisation.error ? <ErrorState title="HVD organisation failed" message={hvdOrganisation.error} /> : null}
          {renderKeyValues(hvdOrganisation.data, 'No HVD organisation payload')}
        </div>
      ) : null}
      {activeTab === 'fi' ? (
        <div className="space-y-6">
          <div className="border-2 border-foreground p-6">
            <div className="mb-4 flex items-center gap-2"><Badge>FI v4</Badge>{fiOrganisation.ok ? <Badge>ok</Badge> : <Badge>error</Badge>}</div>
            {fiOrganisation.error ? <ErrorState title="FI organisation failed" message={fiOrganisation.error} /> : null}
            {renderKeyValues(fiOrganisation.data, 'No FI organisation payload')}
          </div>
          <div className="border-2 border-foreground p-6">
            <p className="mono-label text-[10px]">Financial analysis (FI)</p>
            {fiFinancial.error ? <ErrorState title="FI financial reports failed" message={fiFinancial.error} /> : renderKeyValues(fiFinancial.data, 'No FI financial reports')}
          </div>
        </div>
      ) : null}
      {activeTab === 'reports' ? (
        <div className="space-y-6">
          <div className="border-2 border-foreground p-6">
            <div className="mb-4 flex items-center gap-2"><Badge>HVD</Badge><Badge>Annual reports</Badge></div>
            {hvdDocuments.error ? <ErrorState title="HVD document list failed" message={hvdDocuments.error} /> : null}
            {docs.length === 0 ? <p className="text-sm text-muted-foreground">No HVD annual reports listed.</p> : (
              <ul className="space-y-3">
                {docs.slice(0, 40).map((row, idx) => {
                  const docId = String(row.dokumentId ?? row.dokumentid ?? row.id ?? '');
                  const period = String(row.rapporteringsperiodTom ?? row.ar ?? row.year ?? row.arsredovisningsar ?? '-');
                  const registeredAt = String(row.registreringstidpunkt ?? '-');
                  const format = String(row.filformat ?? '-');
                  return (
                    <li key={`${docId}-${idx}`} className="flex items-center justify-between border-b border-foreground/20 pb-2 text-sm">
                      <span>{period} | registered: {registeredAt} | format: {format} | dokumentId: {docId || 'n/a'}</span>
                      {docId ? (
                        <button
                          className="underline underline-offset-4"
                          onClick={async () => {
                            setDownloadState(`Downloading ${docId}...`);
                            try {
                              const file = await hvdClient.hvdDownloadDocument(docId);
                              const url = URL.createObjectURL(file.blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = file.fileName;
                              link.click();
                              URL.revokeObjectURL(url);
                              setDownloadState(`Downloaded ${file.fileName}`);
                            } catch (e) {
                              setDownloadState(e instanceof Error ? e.message : 'Download failed');
                            }
                          }}
                        >
                          Download
                        </button>
                      ) : <span className="text-muted-foreground">Unavailable</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            {downloadState ? <p className="mt-3 text-sm text-muted-foreground">{downloadState}</p> : null}
          </div>
          <div className="border-2 border-foreground p-6">
            <div className="mb-4 flex items-center gap-2"><Badge>FI v4</Badge><Badge>Financial reports</Badge></div>
            {fiFinancial.error ? <ErrorState title="FI financial reports failed" message={fiFinancial.error} /> : renderKeyValues(fiFinancial.data, 'No FI report payload')}
          </div>
        </div>
      ) : null}
      {activeTab === 'cases' ? <div className="border-2 border-foreground p-6">{fiCases.error ? <ErrorState title="FI cases failed" message={fiCases.error} /> : renderKeyValues(fiCases.data, 'No FI case data')}</div> : null}
      {activeTab === 'capital' ? <div className="border-2 border-foreground p-6">{fiCapital.error ? <ErrorState title="FI share capital failed" message={fiCapital.error} /> : renderKeyValues(fiCapital.data, 'No FI share capital history')}</div> : null}
      {activeTab === 'engagements' ? <div className="border-2 border-foreground p-6">{fiEngagements.error ? <ErrorState title="FI engagements failed" message={fiEngagements.error} /> : renderKeyValues(fiEngagements.data, 'No FI engagements')}</div> : null}
    </section>
  );
}
