import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/tenant.entity';

@Entity({ name: 'integration_tokens' })
@Index(['tenantId', 'providerKey'], { unique: true })
@Index(['tenantId', 'expiresAt'])
export class IntegrationTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'provider_key', type: 'varchar', length: 160 })
  providerKey!: string;

  @Column({ name: 'encrypted_access_token', type: 'text' })
  encryptedAccessToken!: string;

  @Column({ name: 'encrypted_refresh_token', type: 'text', nullable: true })
  encryptedRefreshToken!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'token_type', type: 'varchar', length: 64, nullable: true })
  tokenType!: string | null;

  @Column({ name: 'scope', type: 'varchar', length: 255, nullable: true })
  scope!: string | null;

  @Column({ name: 'last_refreshed_at', type: 'timestamptz', nullable: true })
  lastRefreshedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
