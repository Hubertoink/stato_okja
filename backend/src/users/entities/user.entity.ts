import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Organization } from '../../orgs/entities/organization.entity';
import type { OrganizationMembership } from './organization-membership.entity';

export const SUPPORTED_LOCALES = ['de', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type UserRole = 'superadmin' | 'org_admin' | 'editor' | 'user';
export const SUPPORTED_THEME_MODES = ['system', 'light', 'dark', 'custom'] as const;
export type ThemeMode = (typeof SUPPORTED_THEME_MODES)[number];

const userTimestampColumnType =
  (process.env.DB_TYPE || 'postgres').toLowerCase() === 'postgres'
    ? 'timestamptz'
    : 'datetime';

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

  @ManyToOne('Organization', (o: Organization) => o.users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orgId' })
  org!: Organization | null;

  /** @deprecated Compatibility default; authorization uses memberships. */
  @OneToMany('OrganizationMembership', (membership: OrganizationMembership) => membership.user)
  memberships!: OrganizationMembership[];

  @Column({ type: 'varchar', length: 50, default: 'Default Theme' })
  theme!: string;

  @Column({ type: 'varchar', length: 16, default: 'system' })
  themeMode!: ThemeMode;

  @Column({ type: 'varchar', length: 8, nullable: true })
  locale!: SupportedLocale | null;

  // Login brute-force protection
  @Column({ type: 'int', default: 0 })
  failedLoginAttempts!: number;

  @Column({ type: userTimestampColumnType, nullable: true })
  lastFailedLoginAt!: Date | null;

  @Column({ type: userTimestampColumnType, nullable: true })
  lockoutUntil!: Date | null;

  @Column({ type: 'int', default: 0 })
  passwordResetTokenVersion!: number;

  // Invalidates previously issued invite links whenever an invitation is resent.
  @Column({ type: 'int', default: 0 })
  inviteTokenVersion!: number;

  @Column({ type: 'boolean', default: false })
  mustChangePassword!: boolean;

  @Column({ type: 'varchar', length: 40, nullable: true })
  termsAcceptedVersion!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  termsAcceptedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  twoFactorTokenVersion!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  twoFactorCodeHash!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  twoFactorCodeExpiresAt!: Date | null;

  @Index('IDX_users_refreshTokenId')
  @Column({ type: 'varchar', length: 80, nullable: true })
  refreshTokenId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  refreshTokenHash!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  refreshTokenCsrfHash!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  refreshTokenExpiresAt!: Date | null;
}
