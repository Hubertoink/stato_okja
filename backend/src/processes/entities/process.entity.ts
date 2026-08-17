import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const PROCESS_NODE_TYPES = ['input', 'activity', 'decision', 'branch', 'subprocess', 'file', 'output', 'outcome', 'reflection'] as const;
export type ProcessNodeType = (typeof PROCESS_NODE_TYPES)[number];
export type ProcessPathTone = 'positive' | 'negative' | 'neutral';

export interface ProcessPath {
  id: string;
  label: string;
  tone: ProcessPathTone;
}

export interface ProcessChecklistItem {
  id: string;
  label: string;
}

export type ProcessStepModule = 'duration' | 'resources' | 'checklist' | 'startCondition' | 'completionCriterion';

export interface ProcessDefinition {
  schemaVersion: 1;
  nodes: Array<{
    id: string;
    type: ProcessNodeType;
    position: { x: number; y: number };
    data: { label: string; description?: string; responsibleRole?: string; estimatedDurationMinutes?: number; resources?: string[]; checklist?: ProcessChecklistItem[]; startCondition?: string; completionCriterion?: string; detailModuleOrder?: ProcessStepModule[]; linkedProcessId?: string; fileUrl?: string; fileName?: string; fileMimeType?: string; paths?: ProcessPath[] };
  }>;
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; label?: string }>;
}

@Entity('processes')
@Index(['orgId', 'updatedAt'])
export class Process {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  orgId!: string;

  @Column({ type: 'varchar', length: 180 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  purpose!: string | null;

  @Column({ type: 'simple-json' })
  definition!: ProcessDefinition;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
