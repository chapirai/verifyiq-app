import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'credit_ratings' })
@Index(['tenantId', 'organisationNumber', 'ratedAt'])
export class CreditRatingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 32 })
  organisationNumber!: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId!: string | null;

  @Column({ name: 'rating_provider', type: 'varchar', length: 128, nullable: true })
  ratingProvider!: string | null;

  @Column({ name: 'rating', type: 'varchar', length: 32, nullable: true })
  rating!: string | null;

  @Column({ name: 'rating_score', type: 'integer', nullable: true })
  ratingScore!: number | null;

  @Column({ name: 'rating_description', type: 'text', nullable: true })
  ratingDescription!: string | null;

  @Column({ name: 'risk_class', type: 'varchar', length: 64, nullable: true })
  riskClass!: string | null;

  @Column({ name: 'rated_at', type: 'timestamptz', nullable: true })
  ratedAt!: Date | null;

  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil!: Date | null;

  @Column({ name: 'is_current', type: 'boolean', default: true })
  isCurrent!: boolean;

  @Column({ name: 'source_data', type: 'jsonb', default: () => "'{}'::jsonb" })
  sourceData!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
