import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Organization } from '../../orgs/entities/organization.entity';

export type UserRole = 'superadmin' | 'org_admin' | 'user';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200 })
  email!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  // Store password hash later; for now placeholder
  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 50, default: 'user' })
  role!: UserRole;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'uuid', nullable: true })
  orgId!: string | null;

  @ManyToOne(() => Organization, (o) => o.users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orgId' })
  org!: Organization | null;

  @Column({ type: 'varchar', length: 50, default: 'Default Theme' })
  theme!: string;

  // Login brute-force protection
  @Column({ type: 'int', default: 0 })
  failedLoginAttempts!: number;

  @Column({ type: 'timestamp', nullable: true })
  lastFailedLoginAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lockoutUntil!: Date | null;

  @Column({ type: 'int', default: 0 })
  passwordResetTokenVersion!: number;

  @Column({ type: 'boolean', default: false })
  mustChangePassword!: boolean;

  @Column({ type: 'int', default: 0 })
  twoFactorTokenVersion!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  twoFactorCodeHash!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  twoFactorCodeExpiresAt!: Date | null;
}
