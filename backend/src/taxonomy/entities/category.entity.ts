import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../../orgs/entities/organization.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  standardRef: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  active: boolean;

  @Column({ nullable: true })
  color: string;

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
