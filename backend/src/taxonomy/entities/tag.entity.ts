import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../orgs/entities/organization.entity';

@Entity('tags')
@Index('IDX_tags_org_name', ['orgId', 'name'], { unique: true })
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'simple-array', nullable: true })
  synonyms: string[];

  @Column({ nullable: true })
  color: string;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Mandantentrennung
  @Column({ type: 'uuid', nullable: true })
  orgId: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orgId' })
  org?: Organization | null;
}
