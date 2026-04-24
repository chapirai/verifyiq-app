import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'company_financial_summaries' })
@Index(['organisationNumber'], { unique: true })
export class CompanyFinancialSummaryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organisation_number', type: 'varchar', length: 32 })
  organisationNumber!: string;

  @Column({ name: 'summary_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  summaryJson!: Record<string, unknown>;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

