import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type PasswordSetupTokenType = 'setup' | 'reset';

@Entity({ name: 'password_setup_tokens' })
export class PasswordSetupTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'token_type', type: 'varchar', length: 32, default: 'setup' })
  tokenType!: PasswordSetupTokenType;

  @Column({ name: 'token_hash', type: 'varchar', length: 128 })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

