import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LogbookEntry } from './logbook-entry.entity';

/** A per-user receipt, used to distinguish entries that have not been opened yet. */
@Entity('logbook_entry_views')
@Index('UQ_logbook_entry_views_entry_user', ['entryId', 'userId'], { unique: true })
@Index('IDX_logbook_entry_views_user_entry', ['userId', 'entryId'])
export class LogbookEntryView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  entryId: string;

  @ManyToOne(() => LogbookEntry, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entryId' })
  entry: LogbookEntry;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  readAt: Date;
}
