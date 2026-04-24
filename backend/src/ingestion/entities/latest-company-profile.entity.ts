import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'latest_company_profiles' })
@Index(['organisationNumber'], { unique: true })
export class LatestCompanyProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 32 })
  organisationNumber!: string;

  @Column({ name: 'profile_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  profileJson!: Record<string, unknown>;

  @Column({ name: 'source_lineage', type: 'jsonb', default: () => "'{}'::jsonb" })
  sourceLineage!: Record<string, unknown>;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

