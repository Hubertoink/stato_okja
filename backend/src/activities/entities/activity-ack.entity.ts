import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('activity_acks')
@Index(['userId', 'activityId', 'orgId'], { unique: true })
export class ActivityAck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  activityId: string;

  // Mandantentrennung – redundant zur Activity.orgId gespeichert für schnelle Filterung
  @Column({ type: 'uuid', nullable: true })
  orgId: string | null;

  // Ob der Eintrag als "besprochen/erledigt" markiert ist
  @Column({ type: 'boolean', default: true })
  done: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
