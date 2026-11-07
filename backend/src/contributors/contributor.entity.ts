import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Participants who contribute to an activity; deliberately separate from staff/accounts. */
@Entity('contributors')
@Index('IDX_contributors_orgId', ['orgId'])
export class Contributor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 7, default: '#7aa39a' })
  color: string;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'uuid', nullable: true })
  orgId: string | null;
}
