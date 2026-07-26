import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { ActivityType } from '../../common/enums';
import { Category } from '../../taxonomy/entities/category.entity';
import { Organization } from '../../orgs/entities/organization.entity';
import { ProjectDocument } from './project-document.entity';

@Entity('projects')
@Index('IDX_projects_orgId', ['orgId'])
@Index('IDX_projects_orgId_clientRequestId_unique', ['orgId', 'clientRequestId'], { unique: true })
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'enum', enum: ActivityType })
  type: ActivityType;

  @Column({ type: 'uuid', nullable: true })
  categoryId?: string | null;

  // Zusätzliche Kategorien (Mehrfachzuordnung)
  @ManyToMany(() => Category, { eager: true })
  @JoinTable({
    name: 'project_categories',
    joinColumn: { name: 'projectId' },
    inverseJoinColumn: { name: 'categoryId' },
  })
  categories?: Category[];

  @Column({ type: 'varchar', length: 120, nullable: true })
  targetGroup?: string | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl?: string | null;

  // Größe des Projektbildes in Bytes (für Speicherstatistik)
  @Column({ type: 'bigint', nullable: true })
  imageSize?: number | null;

  // Anzeige-Farbe für Kalender/Badges (HEX)
  @Column({ type: 'varchar', length: 16, nullable: true })
  color?: string | null;

  // Zeitraum (optional)
  @Column({ type: 'date', nullable: true })
  dateFrom?: string | null;

  @Column({ type: 'date', nullable: true })
  dateTo?: string | null;

  // Standardzeiten (optional)
  @Column({ type: 'time', nullable: true })
  defaultStartTime?: string | null;

  @Column({ type: 'time', nullable: true })
  defaultEndTime?: string | null;

  // Standard-Meta (optional)
  @Column({ type: 'text', nullable: true })
  defaultStaff?: string | null; // Mitarbeitende / Ehrenamtliche

  @Column({ type: 'text', nullable: true })
  defaultVolunteers?: string | null; // Freiwillige (aktiv)

  @Column({ type: 'varchar', length: 120, nullable: true })
  tag?: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  activityField?: string | null; // Tätigkeitsfeld

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  clientRequestId?: string | null;

  @Column({ default: false })
  archived: boolean;

  @OneToMany(() => ProjectDocument, (document) => document.project)
  documents?: ProjectDocument[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Mandantentrennung
  @Column({ type: 'uuid', nullable: true })
  orgId: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orgId' })
  org?: Organization | null;
}
