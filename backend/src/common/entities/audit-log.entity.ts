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

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'byStaffId' })
  byStaff: Staff;

  @Column()
  byStaffId: string;

  @Column({ type: 'simple-json', nullable: true })
  diff: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
