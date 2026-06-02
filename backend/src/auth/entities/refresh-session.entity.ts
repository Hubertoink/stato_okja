import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

const refreshSessionTimestampColumnType =
  (process.env.DB_TYPE || 'postgres').toLowerCase() === 'postgres'
    ? 'timestamptz'
    : 'datetime';

@Entity('auth_refresh_sessions')
export class RefreshSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  tokenId!: string;

  @Column({ type: 'varchar', length: 255 })
  tokenHash!: string;

  @Column({ type: 'varchar', length: 255 })
  csrfHash!: string;

  @Column({ type: refreshSessionTimestampColumnType })
  expiresAt!: Date;

  @Column({ type: refreshSessionTimestampColumnType })
  createdAt!: Date;

  @Column({ type: refreshSessionTimestampColumnType })
  lastUsedAt!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  ipAddress!: string | null;
}