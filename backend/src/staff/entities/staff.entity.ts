import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StaffRole } from '../../common/enums';
import { Organization } from '../../orgs/entities/organization.entity';

@Entity('staff')
export class Staff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string | null;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({
    type: 'enum',
    enum: StaffRole,
    default: StaffRole.EMPLOYEE,
  })
  role: StaffRole;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin: Date | null;

  // Mandantentrennung
  @Column({ type: 'uuid', nullable: true })
  orgId: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orgId' })
  org?: Organization | null;
}
