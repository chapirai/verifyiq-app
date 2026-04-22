import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'target_list_items' })
@Index(['tenantId', 'targetListId'])
@Index(['tenantId', 'organisationNumber'])
@Index(['tenantId', 'targetListId', 'organisationNumber'], { unique: true })
export class TargetListItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'target_list_id', type: 'uuid' })
  targetListId!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 32 })
  organisationNumber!: string;

  @Column({ name: 'deal_mode', type: 'varchar', length: 32, nullable: true })
  dealMode!: string | null;

  @Column({ name: 'sourcing_snapshot', type: 'jsonb', default: () => "'{}'::jsonb" })
  sourcingSnapshot!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
