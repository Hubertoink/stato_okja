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
}
