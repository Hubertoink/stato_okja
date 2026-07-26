import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type CustomKpiSurface = 'dashboard' | 'statistics' | 'both';
export type CustomKpiDateMode = 'inherit' | 'current_month' | 'current_year' | 'rolling_weeks';
export type CustomKpiMetric =
  | 'activity_count'
  | 'participant_total'
  | 'duration_hours'
  | 'duration_hours_per_week'
  | 'avg_participants_per_activity'
  | 'participants_per_hour'
  | 'female_total'
  | 'female_share_percent'
  | 'male_total'
  | 'diverse_total';

export type CustomKpiFilters = {
  projectId?: string;
  type?: string;
  executionStatuses?: string[];
  weekdays?: number[];
};

@Entity('custom_kpis')
export class CustomKpi {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_custom_kpis_userId')
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'varchar', length: 20, default: 'both' })
  surface!: CustomKpiSurface;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'varchar', length: 7, default: '#ffffff' })
  backgroundColor!: string;

  @Column({ type: 'varchar', length: 50 })
  metric!: CustomKpiMetric;

  @Column({ type: 'varchar', length: 30, default: 'inherit' })
  dateMode!: CustomKpiDateMode;

  @Column({ type: 'int', nullable: true })
  rollingWeeks!: number | null;

  @Column({ type: 'simple-json', nullable: true })
  filters!: CustomKpiFilters | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
