import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AnnualTargetMetric =
  | 'duration_hours'
  | 'participant_total'
  | 'activity_count'
  | 'female_share_percent'
  | 'male_share_percent'
  | 'diverse_share_percent';
export type AnnualTargetRule = 'min' | 'max' | 'range';
export type AnnualTargetStatus = 'draft' | 'active' | 'closed';
export type AnnualTargetScope = { types?: string[]; projectId?: string; activityId?: string };
export type AnnualTargetSnapshot = {
  value: number | null;
  asOf: string;
  activityCount: number;
  series: Array<{ month: string; value: number | null }>;
};
export type AnnualTargetRevision = {
  at: string;
  actorId: string;
  actorName?: string;
  reason: string;
  definition: {
    title: string;
    year: number;
    metric: AnnualTargetMetric;
    scope: AnnualTargetScope;
    rule: AnnualTargetRule;
    target: number;
    upperTarget: number | null;
    status: AnnualTargetStatus;
    description: string;
    showOnDashboard: boolean;
    review: string;
    snapshot: AnnualTargetSnapshot | null;
  };
};

@Entity('annual_targets')
@Index('IDX_annual_targets_org_year', ['orgId', 'year'])
export class AnnualTarget {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', nullable: true }) orgId!: string | null;
  @Column({ type: 'int' }) year!: number;
  @Column({ type: 'varchar', length: 120 }) title!: string;
  @Column({ type: 'varchar', length: 40 }) metric!: AnnualTargetMetric;
  @Column({ type: 'simple-json' }) scope!: AnnualTargetScope;
  @Column({ type: 'varchar', length: 10 }) rule!: AnnualTargetRule;
  @Column({ type: 'double precision' }) target!: number;
  @Column({ type: 'double precision', nullable: true }) upperTarget!: number | null;
  @Column({ type: 'varchar', length: 10, default: 'draft' }) status!: AnnualTargetStatus;
  @Column({ type: 'text', default: '' }) description!: string;
  @Column({ type: 'boolean', default: true }) showOnDashboard!: boolean;
  @Column({ type: 'text', default: '' }) review!: string;
  @Column({ type: 'simple-json', nullable: true }) snapshot!: AnnualTargetSnapshot | null;
  @Column({ type: 'simple-json' }) history!: AnnualTargetRevision[];
  @Column({ type: 'int', default: 1 }) version!: number;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
