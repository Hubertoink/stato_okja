import { Column, Entity, PrimaryColumn } from 'typeorm';

export type AccountProvisioningPolicy = 'invite' | 'admin_password' | 'both';

/**
 * A single, installation-wide settings record.  Deployment values remain the
 * fallback, so existing installations continue to work without a migration of
 * their environment configuration.
 */
@Entity('system_settings')
export class SystemSettings {
  @PrimaryColumn({ type: 'varchar', length: 32, default: 'global' })
  id!: 'global';

  @Column({ type: 'varchar', length: 200, nullable: true })
  orgName!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  loginSubtitle!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  accountProvisioningPolicy!: AccountProvisioningPolicy | null;
}
