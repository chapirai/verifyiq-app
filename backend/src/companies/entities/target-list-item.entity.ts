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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
