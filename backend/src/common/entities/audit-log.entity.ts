import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AuditAction } from '../enums';
import { Staff } from '../../staff/entities/staff.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entityType: string;

  @Column()
  entityId: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  // Legacy relation (optional)
  @ManyToOne(() => Staff, { nullable: true })
  @JoinColumn({ name: 'byStaffId' })
  byStaff?: Staff | null;

  @Column({ nullable: true })
  byStaffId?: string | null;

  // New user-based auditing
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  userName: string | null;

  // Multi-tenant scoping
  @Column({ type: 'uuid', nullable: true })
  orgId: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  entityTitle: string | null;

  @Column({ type: 'simple-json', nullable: true })
  diff: Record<string, unknown> | null;

  @Column({ type: 'simple-json', nullable: true })
  details: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
