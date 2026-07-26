import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LogbookEntry } from './logbook-entry.entity';
import { User } from '../../users/entities/user.entity';

@Entity('logbook_comments')
@Index('IDX_logbook_comments_entry_createdAt', ['entryId', 'createdAt'])
export class LogbookComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  entryId: string;

  @ManyToOne(() => LogbookEntry, (entry) => entry.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entryId' })
  entry: LogbookEntry;

  @Column({ type: 'uuid', nullable: true })
  orgId: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: User | null;

  @Column({ type: 'varchar', length: 200 })
  createdByName: string;

  @CreateDateColumn()
  createdAt: Date;
}
