import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { AddTargetListItemsBulkDto } from '../dto/add-target-list-items-bulk.dto';
import { AddTargetListItemDto } from '../dto/add-target-list-item.dto';
import { CreateTargetListDto } from '../dto/create-target-list.dto';
import { UpdateTargetListPlaybookDto } from '../dto/update-target-list-playbook.dto';
import { TargetListItemEntity } from '../entities/target-list-item.entity';
import { TargetListEntity } from '../entities/target-list.entity';

function normalizeOrgNumber(raw: string): string {
  return raw.replace(/\D/g, '') || raw;
}

@Injectable()
export class TargetListsService {
  constructor(
    @InjectRepository(TargetListEntity)
    private readonly targetListsRepo: Repository<TargetListEntity>,
    @InjectRepository(TargetListItemEntity)
    private readonly targetListItemsRepo: Repository<TargetListItemEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createList(tenantId: string, actorId: string | null, dto: CreateTargetListDto) {
    const row = this.targetListsRepo.create({
      tenantId,
      name: dto.name.trim(),
      createdByUserId: actorId,
    });
    const saved = await this.targetListsRepo.save(row);
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'target_list.created',
      resourceType: 'target_list',
      resourceId: saved.id,
      metadata: { name: saved.name },
    });
    return saved;
  }

  async listLists(tenantId: string) {
    const lists = await this.targetListsRepo.find({
      where: { tenantId },
      order: { updatedAt: 'DESC' },
    });
    if (lists.length === 0) return [];

    const ids = lists.map((x) => x.id);
    const items = await this.targetListItemsRepo.find({
      where: { tenantId, targetListId: In(ids) },
      order: { createdAt: 'ASC' },
    });
    const byList = new Map<string, string[]>();
    for (const item of items) {
      const curr = byList.get(item.targetListId) ?? [];
      curr.push(item.organisationNumber);
      byList.set(item.targetListId, curr);
    }
    return lists.map((list) => ({
      ...list,
      organisationNumbers: byList.get(list.id) ?? [],
    }));
  }

  async deleteList(tenantId: string, actorId: string | null, listId: string) {
    const exists = await this.targetListsRepo.findOne({ where: { id: listId, tenantId } });
    if (!exists) throw new NotFoundException('Target list not found');
    await this.targetListItemsRepo.delete({ tenantId, targetListId: listId });
    await this.targetListsRepo.delete({ id: listId, tenantId });
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'target_list.deleted',
      resourceType: 'target_list',
      resourceId: listId,
      metadata: null,
    });
    return { id: listId, deleted: true };
  }

  async addItemsBulk(tenantId: string, actorId: string | null, listId: string, dto: AddTargetListItemsBulkDto) {
    const list = await this.targetListsRepo.findOne({ where: { id: listId, tenantId } });
    if (!list) throw new NotFoundException('Target list not found');
    let added = 0;
    let skipped = 0;
    const saved: TargetListItemEntity[] = [];
    for (const raw of dto.organisationNumbers) {
      const org = normalizeOrgNumber(raw);
      if (org.length !== 10 && org.length !== 12) {
        skipped += 1;
        continue;
      }
      const existing = await this.targetListItemsRepo.findOne({
        where: { tenantId, targetListId: listId, organisationNumber: org },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      const item = this.targetListItemsRepo.create({
        tenantId,
        targetListId: listId,
        organisationNumber: org,
        dealMode: dto.dealMode ?? null,
        sourcingSnapshot: dto.dealMode ? { dealMode: dto.dealMode, addedAt: new Date().toISOString() } : {},
      });
      const row = await this.targetListItemsRepo.save(item);
      saved.push(row);
      added += 1;
    }
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'target_list.items_bulk_added',
      resourceType: 'target_list',
      resourceId: listId,
      metadata: { added, skipped, requested: dto.organisationNumbers.length, deal_mode: dto.dealMode ?? null },
    });
    return { added, skipped, items: saved };
  }

  async updatePlaybook(tenantId: string, actorId: string | null, listId: string, dto: UpdateTargetListPlaybookDto) {
    const list = await this.targetListsRepo.findOne({ where: { id: listId, tenantId } });
    if (!list) throw new NotFoundException('Target list not found');
    const nextPlaybook = {
      ...(list.playbook ?? {}),
      ...(dto.dealMode ? { dealMode: dto.dealMode } : {}),
      ...(dto.thesis ? { thesis: dto.thesis } : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: actorId,
    };
    list.playbook = nextPlaybook;
    const saved = await this.targetListsRepo.save(list);
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'target_list.playbook_updated',
      resourceType: 'target_list',
      resourceId: listId,
      metadata: { deal_mode: dto.dealMode ?? null },
    });
    return saved;
  }

  async addItem(tenantId: string, actorId: string | null, listId: string, dto: AddTargetListItemDto) {
    const list = await this.targetListsRepo.findOne({ where: { id: listId, tenantId } });
    if (!list) throw new NotFoundException('Target list not found');
    const org = normalizeOrgNumber(dto.organisationNumber);
    const existing = await this.targetListItemsRepo.findOne({
      where: { tenantId, targetListId: listId, organisationNumber: org },
    });
    if (existing) return existing;
    const item = this.targetListItemsRepo.create({
      tenantId,
      targetListId: listId,
      organisationNumber: org,
    });
    const saved = await this.targetListItemsRepo.save(item);
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'target_list.item_added',
      resourceType: 'target_list_item',
      resourceId: saved.id,
      metadata: { targetListId: listId, organisationNumber: org },
    });
    return saved;
  }

  async removeItem(tenantId: string, actorId: string | null, listId: string, organisationNumber: string) {
    const org = normalizeOrgNumber(organisationNumber);
    await this.targetListItemsRepo.delete({ tenantId, targetListId: listId, organisationNumber: org });
    await this.auditService.log({
      tenantId,
      actorId,
      action: 'target_list.item_removed',
      resourceType: 'target_list_item',
      resourceId: `${listId}:${org}`,
      metadata: { targetListId: listId, organisationNumber: org },
    });
    return { targetListId: listId, organisationNumber: org, deleted: true };
  }
}
