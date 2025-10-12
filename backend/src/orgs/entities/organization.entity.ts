import { Column, Entity, OneToMany, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @OneToMany(() => User, (u) => u.org)
  users!: User[];

  // Hierarchy support
  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => Organization, (o) => o.children, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentId' })
  parent!: Organization | null;

  @OneToMany(() => Organization, (o) => o.parent)
  children!: Organization[];

  // Materialized path for simple subtree queries; contains slash-separated ids, e.g. "<rootId>/<childId>"
  @Index()
  @Column({ type: 'varchar', length: 1200, nullable: true })
  path!: string | null;
}
