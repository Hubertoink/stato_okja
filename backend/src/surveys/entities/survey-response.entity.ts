import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('survey_responses')
@Index(['surveyId', 'deviceTokenHash'], { unique: true })
@Index(['surveyId', 'submittedAt'])
export class SurveyResponse {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  surveyId!: string;

  /** Hash of a random browser-local token. Never exposed in staff views. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  deviceTokenHash!: string | null;

  @Column({ type: 'simple-json' })
  answers!: Record<string, string | string[] | number | null>;

  @CreateDateColumn()
  submittedAt!: Date;
}
