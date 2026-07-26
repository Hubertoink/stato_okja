import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SurveyStatus = 'draft' | 'active' | 'closed' | 'archived';
export type SurveyQuestionType = 'single_choice' | 'multiple_choice' | 'scale' | 'text';

export type SurveyQuestionOption = { id: string; label: string };
export type SurveyQuestion = {
  id: string;
  type: SurveyQuestionType;
  label: string;
  hint?: string;
  required?: boolean;
  options?: SurveyQuestionOption[];
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  demographicKey?: 'age_cohort' | 'gender' | 'origin_area';
};

@Entity('surveys')
@Index(['orgId', 'status'])
@Index(['publicToken'], { unique: true })
@Index(['seriesId', 'roundNumber'], { unique: true })
export class Survey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  orgId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  projectId!: string | null;

  /** The first survey's id identifies a manually repeated survey series. */
  @Column({ type: 'uuid', nullable: true })
  seriesId!: string | null;

  @Column({ type: 'int', default: 1 })
  roundNumber!: number;

  @Column({ type: 'varchar', length: 180 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  introduction!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: SurveyStatus;

  /** Public but cryptographically unguessable identifier used in QR links. */
  @Column({ type: 'varchar', length: 128 })
  publicToken!: string;

  @Column({ type: 'simple-json', nullable: true })
  questions!: SurveyQuestion[] | null;

  @Column({ type: 'boolean', default: false })
  allowMultiplePerDevice!: boolean;

  @Column({ type: 'int', nullable: true })
  expectedParticipants!: number | null;

  @Column({ type: 'timestamp', nullable: true })
  startsAt!: Date | null;

  /** Timestamp at which the survey was actually made available to participants. */
  @Column({ type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endsAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  closedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  rawResponsesPurgeAt!: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  aggregateSnapshot!: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  createdById!: string | null;

  @Column({ type: 'boolean', default: false })
  archived!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
