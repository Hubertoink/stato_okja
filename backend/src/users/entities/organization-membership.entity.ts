import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Organization } from '../../orgs/entities/organization.entity';
import type { User, UserRole } from './user.entity';

export type OrganizationMembershipStatus = 'active' | 'disabled';

/**
 * Grants one account access to exactly one organization. A user's effective
 * role is always taken from the membership selected for the current request.
 */
@Entity('organization_memberships')
@Index('UQ_organization_memberships_user_org', ['userId', 'orgId'], { unique: true })
@Index('IDX_organization_memberships_org_status', ['orgId', 'status'])
export class OrganizationMembership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  orgId!: string;

  @Column({ type: 'varchar', length: 50, default: 'user' })
  role!: Exclude<UserRole, 'superadmin'>;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: OrganizationMembershipStatus;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;

  @ManyToOne('User', (user: User) => user.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne('Organization', (organization: Organization) => organization.memberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orgId' })
  organization!: Organization;
}
