import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ActivityType } from '../../common/enums';
import { Organization } from '../../orgs/entities/organization.entity';

@Entity('project_templates')
export class ProjectTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'enum', enum: ActivityType, enumName: 'projects_type_enum' })
  type: ActivityType;

  @Column({ type: 'varchar', length: 120, nullable: true })
  targetGroup?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  // Stored as name so child orgs can auto-create/select their own category by name
  @Column({ type: 'varchar', length: 120, nullable: true })
  categoryName?: string | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl?: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  color?: string | null;

  @Column({ type: 'boolean', default: false })
  archived: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  orgId: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL', eager: true })
  @JoinColumn({ name: 'orgId' })
  org?: Organization | null;
}
