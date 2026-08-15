import { Column, Entity, OneToMany, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import type { User } from '../../users/entities/user.entity';
import type { OrganizationMembership } from '../../users/entities/organization-membership.entity';

// Öffnungszeiten pro Wochentag
interface DayOpeningHours {
  open: boolean;
  from?: string; // HH:mm format
  to?: string;   // HH:mm format
}

export interface OpeningHours {
  monday: DayOpeningHours;
  tuesday: DayOpeningHours;
  wednesday: DayOpeningHours;
  thursday: DayOpeningHours;
  friday: DayOpeningHours;
  saturday: DayOpeningHours;
  sunday: DayOpeningHours;
}

export interface OrganizationClosureDay {
  date: string; // YYYY-MM-DD
  from?: string | null; // HH:mm format; omitted/null means full-day closure
  to?: string | null; // HH:mm format; omitted/null means full-day closure
}

export type OrganizationTaxonomyType = 'categories' | 'tags' | 'cohorts';

export interface OrganizationTaxonomyTypeSetting {
  allowOwn?: boolean;
  inheritedIds?: string[];
  inheritAll?: boolean;
}

export interface OrganizationTaxonomySettings {
  categories?: OrganizationTaxonomyTypeSetting;
  tags?: OrganizationTaxonomyTypeSetting;
  cohorts?: OrganizationTaxonomyTypeSetting;
}

export interface OrganizationChildTaxonomyDefaults extends OrganizationTaxonomySettings {
  allowChildAdminOverrides?: boolean;
}

export interface OrganizationTaxonomySettingsUpdatePayload {
  settings?: OrganizationTaxonomySettings | null;
  childDefaults?: OrganizationChildTaxonomyDefaults | null;
}

export const DEFAULT_ORGANIZATION_LOCALE = 'de';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 8, default: DEFAULT_ORGANIZATION_LOCALE })
  defaultLocale!: string;

  // Visual identity shown in the application header for the active organisation.
  // These values deliberately do not inherit through the organisation tree.
  @Column({ type: 'varchar', length: 500, nullable: true })
  bannerUrl!: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  brandColor!: string | null;

  @Column({ type: 'smallint', nullable: true })
  bannerPosition!: number | null;

  @OneToMany('User', (u: User) => u.org)
  users!: User[];

  @OneToMany('OrganizationMembership', (membership: OrganizationMembership) => membership.organization)
  memberships!: OrganizationMembership[];

  // Hierarchy support
  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => Organization, (o) => o.children, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentId' })
  parent!: Organization | null;

  @OneToMany(() => Organization, (o) => o.parent)
  children!: Organization[];

  // Materialized path for simple subtree queries; contains slash-separated ids, e.g. "<rootId>/<childId>"
  @Index()
  @Column({ type: 'varchar', length: 1200, nullable: true })
  path!: string | null;

  // Öffnungszeiten als JSON
  @Column({ type: 'simple-json', nullable: true })
  openingHours!: OpeningHours | null;

  // Tagesbezogene Schließzeiten der Einrichtung
  @Column({ type: 'simple-json', nullable: true })
  closureDays!: OrganizationClosureDay[] | null;

  // Kind-spezifische Regeln für geerbte Statistik-Taxonomien
  @Column({ type: 'simple-json', nullable: true })
  taxonomySettings!: OrganizationTaxonomySettings | null;

  // Standardregeln, die Unterorganisationen ohne eigenen Override übernehmen
  @Column({ type: 'simple-json', nullable: true })
  childTaxonomyDefaults!: OrganizationChildTaxonomyDefaults | null;
}
