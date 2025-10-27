import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ActivityType } from '../../common/enums';
import { Location } from '../../locations/entities/location.entity';
import { Category } from '../../taxonomy/entities/category.entity';
import { Tag } from '../../taxonomy/entities/tag.entity';
import { Staff } from '../../staff/entities/staff.entity';
import { Attachment } from './attachment.entity';
import { Project } from '../../projects/entities/project.entity';

@Entity('activities')
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'time', nullable: true })
  startTime: string;

  @Column({ type: 'time', nullable: true })
  endTime: string;

  @Column({ type: 'int', nullable: true })
  durationMinutes: number;

  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  type: ActivityType;

  @ManyToOne(() => Location, { eager: true, nullable: true })
  @JoinColumn({ name: 'locationId' })
  location: Location | null;

  @Column({ nullable: true })
  locationId: string | null;

  // Geschlechts-Verteilung
  @Column({ type: 'int', default: 0 })
  countMale: number;

  @Column({ type: 'int', default: 0 })
  countFemale: number;

  @Column({ type: 'int', default: 0 })
  countDiverse: number;

  // Gesamt-Teilnehmende
  @Column({ type: 'int', default: 0 })
  countTotal: number;

  // Freitext-Titel je Aktivität (optional)
  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  // Kohorten mit Geschlechtsaufschlüsselung als JSON (sqlite: simple-json)
  // [{ cohortId, m, w, d }]
  @Column({ type: 'simple-json', nullable: true })
  cohorts: Array<{ cohortId: string; m: number; w: number; d: number }>;

  // Kategorien (Many-to-Many)
  @ManyToMany(() => Category, { eager: true })
  @JoinTable({
    name: 'activity_categories',
    joinColumn: { name: 'activityId' },
    inverseJoinColumn: { name: 'categoryId' },
  })
  categories: Category[];

  // Tags (Many-to-Many)
  @ManyToMany(() => Tag, { eager: true })
  @JoinTable({
    name: 'activity_tags',
    joinColumn: { name: 'activityId' },
    inverseJoinColumn: { name: 'tagId' },
  })
  tags: Tag[];

  // Mitarbeitende (Many-to-Many)
  @ManyToMany(() => Staff, { eager: true })
  @JoinTable({
    name: 'activity_staff',
    joinColumn: { name: 'activityId' },
    inverseJoinColumn: { name: 'staffId' },
  })
  staff: Staff[];

  // Notizen & Dokumentation
  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  goals: string;

  // Anhänge
  @OneToMany(() => Attachment, (attachment) => attachment.activity, {
    cascade: true,
  })
  attachments: Attachment[];

  // Audit-Felder
  @Column({ nullable: true })
  createdById: string;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'createdById' })
  createdBy: Staff;

  @Column({ nullable: true })
  updatedById: string;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'updatedById' })
  updatedBy: Staff;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Daily Log acknowledgment (per activity/org)
  // When true, the activity has been marked as "discussed/done" in the Daily Log
  @Column({ type: 'boolean', default: false })
  ackDone: boolean;

  // Projekt-Bezug (optional)
  @ManyToOne(() => Project, { eager: true, nullable: true })
  @JoinColumn({ name: 'projectId' })
  project?: Project | null;

  @Column({ type: 'varchar', nullable: true })
  projectId?: string | null;

  // Mandantentrennung
  @Column({ type: 'uuid', nullable: true })
  orgId: string | null;
}
