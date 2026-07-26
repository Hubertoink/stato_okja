import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LogbookEntryStatus, LogbookEntryType, LogbookVisibility } from '../../common/enums';
import { Activity } from '../../activities/entities/activity.entity';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';
import { LogbookComment } from './logbook-comment.entity';

@Entity('logbook_entries')
@Index('IDX_logbook_entries_org_occurredAt', ['orgId', 'occurredAt'])
@Index('IDX_logbook_entries_org_status', ['orgId', 'status'])
@Index('IDX_logbook_entries_activityId', ['activityId'])
@Index('IDX_logbook_entries_projectId', ['projectId'])
export class LogbookEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  orgId: string | null;

  @Column({ type: 'timestamp' })
  occurredAt: Date;

  @Column({ type: 'enum', enum: LogbookEntryType, default: LogbookEntryType.OBSERVATION })
  type: LogbookEntryType;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text', nullable: true })
  highlights: string | null;

  @Column({ type: 'text', nullable: true })
  challenges: string | null;

  @Column({ type: 'text', nullable: true })
  nextSteps: string | null;

  @Column({ type: 'enum', enum: LogbookEntryStatus, default: LogbookEntryStatus.OPEN })
  status: LogbookEntryStatus;

  @Column({ type: 'enum', enum: LogbookVisibility, default: LogbookVisibility.TEAM })
  visibility: LogbookVisibility;

  @Column({ type: 'uuid', nullable: true })
  activityId: string | null;

  @ManyToOne(() => Activity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'activityId' })
  activity: Activity | null;

  @Column({ type: 'uuid', nullable: true })
  projectId: string | null;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'projectId' })
  project: Project | null;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: User | null;

  @Column({ type: 'varchar', length: 200 })
  createdByName: string;

  @Column({ type: 'uuid', nullable: true })
  updatedByUserId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  updatedByName: string | null;

  @Column({ type: 'uuid', nullable: true })
  documentationUpdatedByUserId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  documentationUpdatedByName: string | null;

  @Column({ type: 'timestamp', nullable: true })
  documentationUpdatedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  discussedByUserId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  discussedByName: string | null;

  @Column({ type: 'timestamp', nullable: true })
  discussedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  archivedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  archivedByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => LogbookComment, (comment) => comment.entry)
  comments: LogbookComment[];
}
