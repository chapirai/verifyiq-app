import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CreateBeneficialOwnerDto } from './dto/create-beneficial-owner.dto';
import { CreateOwnershipLinkDto } from './dto/create-ownership-link.dto';
import { CreateWorkplaceDto } from './dto/create-workplace.dto';
import { BeneficialOwnerEntity } from './entities/beneficial-owner.entity';
import { OwnershipLinkEntity } from './entities/ownership-link.entity';
import { WorkplaceEntity } from './entities/workplace.entity';

@Injectable()
export class OwnershipService {
  constructor(
    @InjectRepository(OwnershipLinkEntity)
    private readonly ownershipLinksRepo: Repository<OwnershipLinkEntity>,
    @InjectRepository(BeneficialOwnerEntity)
    private readonly beneficialOwnersRepo: Repository<BeneficialOwnerEntity>,
    @InjectRepository(WorkplaceEntity)
    private readonly workplacesRepo: Repository<WorkplaceEntity>,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /** Max BFS waves when collecting links whose `owned` org appears on a path up from the subject company. */
  private static readonly OWNERSHIP_SUBGRAPH_MAX_WAVES = 48;

  private static readonly IN_QUERY_CHUNK = 400;

  /**
   * Load only ownership_links rows reachable upward from `rootOrg` (subject as owned entity),
   * instead of scanning every current link for the tenant.
   */
  private async collectRelevantOwnershipLinks(
    tenantId: string,
    rootOrg: string,
  ): Promise<{
    links: OwnershipLinkEntity[];
    expansionWaves: number;
    distinctOwnedOrgsVisited: number;
  }> {
    const collected: OwnershipLinkEntity[] = [];
    const seenLinkIds = new Set<string>();
    const seenOwnedQueried = new Set<string>();
    let frontier = new Set<string>([rootOrg]);
    let expansionWaves = 0;

    for (let wave = 0; wave < OwnershipService.OWNERSHIP_SUBGRAPH_MAX_WAVES && frontier.size > 0; wave++) {
      expansionWaves += 1;
      const toQuery = [...frontier].filter((o) => !seenOwnedQueried.has(o));
      frontier = new Set();
      if (toQuery.length === 0) {
        break;
      }
      for (const o of toQuery) {
        seenOwnedQueried.add(o);
      }
      for (let i = 0; i < toQuery.length; i += OwnershipService.IN_QUERY_CHUNK) {
        const chunk = toQuery.slice(i, i + OwnershipService.IN_QUERY_CHUNK);
        const batch = await this.ownershipLinksRepo.find({
          where: { tenantId, isCurrent: true, ownedOrganisationNumber: In(chunk) },
          order: { createdAt: 'DESC' },
        });
        for (const link of batch) {
          if (seenLinkIds.has(link.id)) {
            continue;
          }
          seenLinkIds.add(link.id);
          collected.push(link);
          if (link.ownerType === 'company' && link.ownerOrganisationNumber) {
            const od = link.ownerOrganisationNumber.replace(/\D/g, '');
            if (od) {
              frontier.add(od);
            }
          }
        }
      }
    }

    return {
      links: collected,
      expansionWaves,
      distinctOwnedOrgsVisited: seenOwnedQueried.size,
    };
  }

  private normalisePersonKey(personnummer: string | null | undefined, name: string): string {
    const d = (personnummer ?? '').replace(/\D/g, '');
    if (d.length >= 10) {
      return d;
    }
    return `name:${name.trim().toLowerCase()}`;
  }

  private linkNumericOwnershipPct(link: OwnershipLinkEntity): number | null {
    if (link.ownershipPercentage == null) {
      return null;
    }
    const n = Number(link.ownershipPercentage);
    return Number.isFinite(n) ? n : null;
  }

  private linkNumericControlPct(link: OwnershipLinkEntity, ownershipPct: number | null): number | null {
    if (link.controlPercentage != null) {
      const n = Number(link.controlPercentage);
      if (Number.isFinite(n)) {
        return n;
      }
    }
    return ownershipPct;
  }

  private edgeWeightsComplete(link: OwnershipLinkEntity): boolean {
    const o = this.linkNumericOwnershipPct(link);
    const c = this.linkNumericControlPct(link, o);
    return (o != null && o > 0) || (c != null && c > 0);
  }

  private async fetchLatestVhPayload(
    tenantId: string,
    rootOrg: string,
  ): Promise<{ fetchedAt: string | null; requestId: string | null; payload: Record<string, unknown> | null }> {
    const rows = await this.dataSource.query<
      Array<{
        fetched_at: Date | string;
        request_id: string | null;
        payload: Record<string, unknown> | null;
      }>
    >(
      `SELECT fetched_at, request_id, payload
       FROM bv_vh_payloads
       WHERE tenant_id = $1::uuid AND organisationsnummer = $2
       ORDER BY fetched_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [tenantId, rootOrg],
    );
    const r = rows[0];
    if (!r?.payload || typeof r.payload !== 'object') {
      return { fetchedAt: null, requestId: null, payload: null };
    }
    const fetchedAt =
      r.fetched_at instanceof Date ? r.fetched_at.toISOString() : r.fetched_at != null ? String(r.fetched_at) : null;
    return { fetchedAt, requestId: r.request_id ?? null, payload: r.payload };
  }

  private extractVhRegisterPersons(payload: Record<string, unknown>): Array<{
    key: string;
    name: string;
    personnummer: string | null;
    anonym: boolean;
  }> {
    const out: Array<{ key: string; name: string; personnummer: string | null; anonym: boolean }> = [];
    const pushBlock = (p: Record<string, unknown>) => {
      const anonym = p.arAnonym === true;
      const pn = p.personnamn as Record<string, unknown> | undefined;
      const name =
        pn && typeof pn === 'object'
          ? [pn.fornamn, pn.mellannamn, pn.efternamn].filter((x) => x != null && String(x).trim()).map(String).join(' ') ||
            '—'
          : '—';
      const ident = p.identitet as Record<string, unknown> | undefined;
      const rawId = ident?.identitetsbeteckning != null ? String(ident.identitetsbeteckning) : null;
      const personnummer = rawId ? rawId.replace(/\D/g, '') || null : null;
      const key = this.normalisePersonKey(personnummer, name);
      out.push({ key, name, personnummer, anonym });
    };

    const vh = payload.verkligHuvudman;
    if (Array.isArray(vh)) {
      for (const item of vh) {
        if (item && typeof item === 'object') {
          pushBlock(item as Record<string, unknown>);
        }
      }
    }
    const fore = payload.foretradare;
    if (Array.isArray(fore)) {
      for (const item of fore) {
        if (item && typeof item === 'object') {
          pushBlock(item as Record<string, unknown>);
        }
      }
    }
    return out;
  }

  async createOwnershipLink(tenantId: string, actorId: string | null, dto: CreateOwnershipLinkDto) {
    const link = this.ownershipLinksRepo.create({
      tenantId,
      ownerType: dto.ownerType,
      ownerName: dto.ownerName,
      ownerPersonId: dto.ownerPersonId ?? null,
      ownerCompanyId: dto.ownerCompanyId ?? null,
      ownerOrganisationNumber: dto.ownerOrganisationNumber ?? null,
      ownerPersonnummer: dto.ownerPersonnummer ?? null,
      ownedCompanyId: dto.ownedCompanyId ?? null,
      ownedOrganisationNumber: dto.ownedOrganisationNumber,
      ownedCompanyName: dto.ownedCompanyName,
      ownershipPercentage: dto.ownershipPercentage ?? null,
      ownershipType: dto.ownershipType ?? null,
      ownershipClass: dto.ownershipClass ?? null,
      controlPercentage: dto.controlPercentage ?? null,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validTo: dto.validTo ? new Date(dto.validTo) : null,
      isCurrent: dto.isCurrent ?? true,
      sourceData: dto.sourceData ?? {},
    });
    const saved = await this.ownershipLinksRepo.save(link);
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'ownership.link.created',
      resourceType: 'ownership_link',
      resourceId: saved.id,
      metadata: dto,
    });
    return saved;
  }

  listOwnershipLinks(tenantId: string, organisationNumber?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (organisationNumber) {
      where['ownedOrganisationNumber'] = organisationNumber;
    }
    return this.ownershipLinksRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  listOwners(tenantId: string, organisationNumber: string) {
    return this.ownershipLinksRepo.find({
      where: { tenantId, ownedOrganisationNumber: organisationNumber },
      order: { createdAt: 'DESC' },
    });
  }

  listOwnedCompanies(tenantId: string, ownerOrganisationNumber: string) {
    return this.ownershipLinksRepo.find({
      where: { tenantId, ownerOrganisationNumber },
      order: { createdAt: 'DESC' },
    });
  }

  async createBeneficialOwner(tenantId: string, actorId: string | null, dto: CreateBeneficialOwnerDto) {
    const owner = this.beneficialOwnersRepo.create({
      tenantId,
      organisationNumber: dto.organisationNumber,
      companyId: dto.companyId ?? null,
      personName: dto.personName,
      personnummer: dto.personnummer ?? null,
      ownershipPercentage: dto.ownershipPercentage ?? null,
      controlPercentage: dto.controlPercentage ?? null,
      ownershipType: dto.ownershipType ?? null,
      isAlternativeBeneficialOwner: dto.isAlternativeBeneficialOwner ?? false,
      alternativeReason: dto.alternativeReason ?? null,
      isCurrent: dto.isCurrent ?? true,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validTo: dto.validTo ? new Date(dto.validTo) : null,
      sourceType: dto.sourceType ?? null,
      sourceData: dto.sourceData ?? {},
    });
    const saved = await this.beneficialOwnersRepo.save(owner);
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'ownership.beneficial_owner.created',
      resourceType: 'beneficial_owner',
      resourceId: saved.id,
      metadata: dto,
    });
    return saved;
  }

  listBeneficialOwners(tenantId: string, organisationNumber: string) {
    return this.beneficialOwnersRepo.find({
      where: { tenantId, organisationNumber },
      order: { createdAt: 'DESC' },
    });
  }

  async createWorkplace(tenantId: string, actorId: string | null, dto: CreateWorkplaceDto) {
    const workplace = this.workplacesRepo.create({
      tenantId,
      organisationNumber: dto.organisationNumber,
      companyId: dto.companyId ?? null,
      cfarNumber: dto.cfarNumber ?? null,
      workplaceName: dto.workplaceName ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      postalAddress: dto.postalAddress ?? {},
      deliveryAddress: dto.deliveryAddress ?? null,
      coordinates: dto.coordinates ?? null,
      municipalityCode: dto.municipalityCode ?? null,
      municipalityName: dto.municipalityName ?? null,
      countyCode: dto.countyCode ?? null,
      countyName: dto.countyName ?? null,
      industryCode: dto.industryCode ?? null,
      industryDescription: dto.industryDescription ?? null,
      isActive: dto.isActive ?? true,
      sourceData: dto.sourceData ?? {},
    });
    const saved = await this.workplacesRepo.save(workplace);
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'ownership.workplace.created',
      resourceType: 'workplace',
      resourceId: saved.id,
      metadata: dto,
    });
    return saved;
  }

  listWorkplaces(tenantId: string, organisationNumber?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (organisationNumber) {
      where['organisationNumber'] = organisationNumber;
    }
    return this.workplacesRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async getOwnershipGraph(tenantId: string, organisationNumber: string) {
    const rootOrg = (organisationNumber ?? '').replace(/\D/g, '');
    const [subgraph, beneficialOwners, vhSnapshot] = await Promise.all([
      this.collectRelevantOwnershipLinks(tenantId, rootOrg),
      this.beneficialOwnersRepo.find({
        where: { tenantId, organisationNumber: rootOrg, isCurrent: true },
        order: { createdAt: 'DESC' },
      }),
      this.fetchLatestVhPayload(tenantId, rootOrg),
    ]);
    const links = subgraph.links;

    const ownedByMap = new Map<string, OwnershipLinkEntity[]>();
    for (const link of links) {
      const owned = (link.ownedOrganisationNumber ?? '').replace(/\D/g, '');
      if (!owned) continue;
      const curr = ownedByMap.get(owned) ?? [];
      curr.push(link);
      ownedByMap.set(owned, curr);
    }

    const nodes = new Map<string, { id: string; label: string; type: 'company' | 'person'; organisationNumber?: string | null; personnummer?: string | null }>();
    const edges: Array<{
      id: string;
      from: string;
      to: string;
      ownershipPercentage: number | null;
      controlPercentage: number | null;
      ownershipType: string | null;
      direct: boolean;
    }> = [];
    const queue: Array<{ org: string; depth: number }> = [{ org: rootOrg, depth: 0 }];
    const visited = new Set<string>();

    nodes.set(`company:${rootOrg}`, {
      id: `company:${rootOrg}`,
      label: rootOrg,
      type: 'company',
      organisationNumber: rootOrg,
      personnummer: null,
    });

    while (queue.length > 0) {
      const next = queue.shift()!;
      if (next.depth > 4) continue;
      if (visited.has(next.org)) continue;
      visited.add(next.org);
      const directOwners = ownedByMap.get(next.org) ?? [];
      for (const link of directOwners) {
        const ownerNodeId =
          link.ownerType === 'person'
            ? `person:${link.ownerPersonnummer ?? link.ownerName}`
            : `company:${(link.ownerOrganisationNumber ?? '').replace(/\D/g, '')}`;
        const targetNodeId = `company:${next.org}`;
        if (!nodes.has(ownerNodeId)) {
          nodes.set(ownerNodeId, {
            id: ownerNodeId,
            label: link.ownerName,
            type: link.ownerType,
            organisationNumber: link.ownerOrganisationNumber ?? null,
            personnummer: link.ownerPersonnummer ?? null,
          });
        }
        if (!nodes.has(targetNodeId)) {
          nodes.set(targetNodeId, {
            id: targetNodeId,
            label: link.ownedCompanyName || next.org,
            type: 'company',
            organisationNumber: next.org,
            personnummer: null,
          });
        }
        edges.push({
          id: link.id,
          from: ownerNodeId,
          to: targetNodeId,
          ownershipPercentage: link.ownershipPercentage != null ? Number(link.ownershipPercentage) : null,
          controlPercentage: link.controlPercentage != null ? Number(link.controlPercentage) : null,
          ownershipType: link.ownershipType,
          direct: next.depth === 0,
        });
        if (link.ownerType === 'company' && link.ownerOrganisationNumber) {
          queue.push({ org: link.ownerOrganisationNumber.replace(/\D/g, ''), depth: next.depth + 1 });
        }
      }
    }

    type Aggregate = { name: string; personnummer: string | null; ownership: number; control: number; paths: number };
    const aggregates = new Map<string, Aggregate>();
    const traverse = (org: string, ownershipMul: number, controlMul: number, depth: number) => {
      if (depth > 5) return;
      const directOwners = ownedByMap.get(org) ?? [];
      for (const link of directOwners) {
        const ownN = this.linkNumericOwnershipPct(link);
        const ctrlN = this.linkNumericControlPct(link, ownN);
        const own = ownN ?? 0;
        const ctrl = ctrlN ?? 0;
        const nextOwnership = (ownershipMul * own) / 100;
        const nextControl = (controlMul * ctrl) / 100;
        if (link.ownerType === 'person') {
          const key = this.normalisePersonKey(link.ownerPersonnummer, link.ownerName);
          const curr = aggregates.get(key) ?? {
            name: link.ownerName,
            personnummer: link.ownerPersonnummer ?? null,
            ownership: 0,
            control: 0,
            paths: 0,
          };
          curr.ownership += nextOwnership;
          curr.control += nextControl;
          curr.paths += 1;
          aggregates.set(key, curr);
        } else if (link.ownerOrganisationNumber) {
          traverse(link.ownerOrganisationNumber.replace(/\D/g, ''), nextOwnership, nextControl, depth + 1);
        }
      }
    };
    traverse(rootOrg, 100, 100, 0);

    for (const bo of beneficialOwners) {
      const key = this.normalisePersonKey(bo.personnummer, bo.personName);
      const curr = aggregates.get(key) ?? {
        name: bo.personName,
        personnummer: bo.personnummer ?? null,
        ownership: 0,
        control: 0,
        paths: 0,
      };
      curr.ownership = Math.max(curr.ownership, bo.ownershipPercentage != null ? Number(bo.ownershipPercentage) : 0);
      curr.control = Math.max(curr.control, bo.controlPercentage != null ? Number(bo.controlPercentage) : curr.ownership);
      curr.paths += 1;
      aggregates.set(key, curr);
    }

    const ubos = [...aggregates.values()]
      .filter((x) => x.ownership >= 25 || x.control >= 25)
      .sort((a, b) => b.control - a.control || b.ownership - a.ownership);

    type ControlPath = {
      summary: string;
      cumulativeOwnershipPercentage: number;
      cumulativeControlPercentage: number;
      /** True when at least one step had no usable numeric ownership/control weight (strict zero used). */
      hasUnknownEdgeWeights: boolean;
      steps: Array<{
        linkId: string;
        fromLabel: string;
        fromOrganisationNumber: string | null;
        fromPersonnummer: string | null;
        ownerType: string;
        toOrganisationNumber: string;
        toCompanyName: string;
        ownershipPercentage: number | null;
        controlPercentage: number | null;
        /** Both numeric weights present and at least one > 0 (used for path confidence). */
        weightComplete: boolean;
      }>;
    };

    const controlPaths: ControlPath[] = [];
    const maxPathRecords = 40;

    const walkUp = (
      ownedOrgDigits: string,
      cumOwn: number,
      cumCtrl: number,
      chain: OwnershipLinkEntity[],
      depth: number,
    ): void => {
      if (depth > 6 || controlPaths.length >= maxPathRecords) return;
      const directOwners = ownedByMap.get(ownedOrgDigits) ?? [];
      for (const link of directOwners) {
        const ownN = this.linkNumericOwnershipPct(link);
        const ctrlN = this.linkNumericControlPct(link, ownN);
        const ownFactor = ownN != null && ownN > 0 ? ownN / 100 : 0;
        const ctrlFactor = ctrlN != null && ctrlN > 0 ? ctrlN / 100 : ownN != null && ownN > 0 ? ownN / 100 : 0;
        const nextOwn = cumOwn * ownFactor;
        const nextCtrl = cumCtrl * ctrlFactor;
        const nextChain = [...chain, link];

        if (link.ownerType === 'person') {
          const parts: string[] = [];
          for (const l of nextChain) {
            parts.push(l.ownerName);
          }
          const targetName = nextChain[nextChain.length - 1]?.ownedCompanyName ?? rootOrg;
          parts.push(`${targetName} (${rootOrg})`);
          const steps = nextChain.map((l) => ({
            linkId: l.id,
            fromLabel: l.ownerName,
            fromOrganisationNumber:
              l.ownerOrganisationNumber != null ? String(l.ownerOrganisationNumber).replace(/\D/g, '') || null : null,
            fromPersonnummer: l.ownerPersonnummer ?? null,
            ownerType: l.ownerType,
            toOrganisationNumber: String(l.ownedOrganisationNumber).replace(/\D/g, ''),
            toCompanyName: l.ownedCompanyName,
            ownershipPercentage: l.ownershipPercentage != null ? Number(l.ownershipPercentage) : null,
            controlPercentage: l.controlPercentage != null ? Number(l.controlPercentage) : null,
            weightComplete: this.edgeWeightsComplete(l),
          }));
          const hasUnknownEdgeWeights = steps.some((s) => !s.weightComplete);
          controlPaths.push({
            summary: parts.join(' → '),
            cumulativeOwnershipPercentage: Number(nextOwn.toFixed(4)),
            cumulativeControlPercentage: Number(nextCtrl.toFixed(4)),
            hasUnknownEdgeWeights,
            steps,
          });
        } else if (link.ownerOrganisationNumber) {
          const parent = link.ownerOrganisationNumber.replace(/\D/g, '');
          if (parent) walkUp(parent, nextOwn, nextCtrl, nextChain, depth + 1);
        }
      }
    };
    walkUp(rootOrg, 100, 100, [], 0);

    const pathSignature = (p: (typeof controlPaths)[number]) => p.steps.map((s) => s.linkId).join('>');
    const seenSignatures = new Set<string>();
    const dedupedControlPaths: typeof controlPaths = [];
    for (const p of controlPaths) {
      const sig = pathSignature(p);
      if (seenSignatures.has(sig)) continue;
      seenSignatures.add(sig);
      dedupedControlPaths.push(p);
    }

    dedupedControlPaths.sort((a, b) => b.cumulativeControlPercentage - a.cumulativeControlPercentage);
    const topPaths = dedupedControlPaths.slice(0, 25);

    let maxDepth = 0;
    for (const p of topPaths) {
      if (p.steps.length > maxDepth) maxDepth = p.steps.length;
    }
    for (const e of edges) {
      // depth 1 = direct edge to root
      if (e.direct) maxDepth = Math.max(maxDepth, 1);
    }

    const vhRegisterPersons = vhSnapshot.payload
      ? this.extractVhRegisterPersons(vhSnapshot.payload).filter((p) => !p.anonym)
      : [];
    const registerByKey = new Map(vhRegisterPersons.map((p) => [p.key, p]));

    const allPersonKeys = new Set<string>();
    for (const k of aggregates.keys()) {
      allPersonKeys.add(k);
    }
    for (const p of vhRegisterPersons) {
      allPersonKeys.add(p.key);
    }

    const uboQualifiedKeys = new Set(ubos.map((u) => this.normalisePersonKey(u.personnummer, u.name)));

    const reconciliationRows = [...allPersonKeys].map((key) => {
      const agg = aggregates.get(key);
      const vhRow = registerByKey.get(key);
      const registerListed = vhRow != null;
      const derivedMeetsThreshold = agg != null && (agg.ownership >= 25 || agg.control >= 25);
      const inUboTable = uboQualifiedKeys.has(key);
      let status: 'aligned' | 'register_only' | 'derived_ubo_only' | 'chain_context';
      if (registerListed && derivedMeetsThreshold) {
        status = 'aligned';
      } else if (registerListed) {
        status = 'register_only';
      } else if (inUboTable) {
        status = 'derived_ubo_only';
      } else {
        status = 'chain_context';
      }
      return {
        key,
        label: vhRow?.name ?? agg?.name ?? key,
        registerListed,
        shareChainDerivedMeetsThreshold: derivedMeetsThreshold,
        inDerivedUboTable: inUboTable,
        calculatedEffectiveOwnership: agg != null ? Number(agg.ownership.toFixed(2)) : null,
        calculatedEffectiveControl: agg != null ? Number(agg.control.toFixed(2)) : null,
        status,
      };
    });
    const statusOrder: Record<string, number> = {
      aligned: 0,
      register_only: 1,
      derived_ubo_only: 2,
      chain_context: 3,
    };
    reconciliationRows.sort(
      (a, b) =>
        (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) || a.label.localeCompare(b.label),
    );

    const hasLinks = edges.length > 0;
    const hasBoRows = beneficialOwners.length > 0;
    let opaqueOwnershipRisk: 'low' | 'medium' | 'high' = 'low';
    if (!hasLinks && !hasBoRows) opaqueOwnershipRisk = 'high';
    else if (!hasLinks || !hasBoRows) opaqueOwnershipRisk = 'medium';

    return {
      organisationNumber: rootOrg,
      nodes: [...nodes.values()],
      edges,
      ubos: ubos.map((u) => ({
        name: u.name,
        personnummer: u.personnummer,
        effectiveOwnershipPercentage: Number(u.ownership.toFixed(2)),
        effectiveControlPercentage: Number(u.control.toFixed(2)),
        qualificationReason: u.control >= 25 ? 'control>=25%' : 'ownership>=25%',
      })),
      controlPaths: topPaths,
      dataCoverage: {
        hasOwnershipLinks: hasLinks,
        hasBeneficialOwnerRows: hasBoRows,
        opaqueOwnershipRisk,
        hasVerkligaHuvudmanSnapshot: vhSnapshot.payload != null,
      },
      structuralComplexity: {
        ownerNodes: [...nodes.values()].filter((n) => n.id !== `company:${rootOrg}`).length,
        ownershipLinks: edges.length,
        maxChainDepth: maxDepth,
      },
      subgraph: {
        linksLoaded: links.length,
        expansionWaves: subgraph.expansionWaves,
        distinctOwnedOrgsVisited: subgraph.distinctOwnedOrgsVisited,
      },
      verkligaHuvudmanRegister: vhSnapshot.payload
        ? {
            fetchedAt: vhSnapshot.fetchedAt,
            requestId: vhSnapshot.requestId,
            persons: vhRegisterPersons.map(({ key, name, personnummer }) => ({ key, name, personnummer })),
          }
        : null,
      reconciliation: {
        summary: {
          aligned: reconciliationRows.filter((r) => r.status === 'aligned').length,
          registerOnly: reconciliationRows.filter((r) => r.status === 'register_only').length,
          derivedUboOnly: reconciliationRows.filter((r) => r.status === 'derived_ubo_only').length,
          chainContext: reconciliationRows.filter((r) => r.status === 'chain_context').length,
        },
        rows: reconciliationRows,
      },
    };
  }
}
