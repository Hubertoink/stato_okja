import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Activity } from './activity.entity';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('Activity', (activity: Activity) => activity.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'activityId' })
  activity: Activity;

  @Column()
  activityId: string;

  @Column()
  filename: string;

  @Column()
  mimeType: string;

  @Column({ type: 'int' })
  size: number;

  @Column()
  storageRef: string;

  @Column({ nullable: true })
  url: string;

  @CreateDateColumn()
  createdAt: Date;
}
