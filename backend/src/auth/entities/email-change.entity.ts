import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('auth_email_changes')
export class EmailChange {
  @PrimaryColumn('uuid', { primaryKeyConstraintName: 'PK_auth_email_changes_user' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_auth_email_changes_user' })
  user!: User;

  @Index('IDX_auth_email_changes_request', { unique: true })
  @Column('uuid')
  requestId!: string;

  @Column({ length: 200 })
  oldEmail!: string;

  @Column({ length: 200 })
  newEmail!: string;

  @Column({ length: 64 })
  passwordFingerprint!: string;

  @Column({ type: (process.env.DB_TYPE || 'postgres').toLowerCase() === 'postgres' ? 'timestamptz' : 'datetime' })
  expiresAt!: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  approveHash!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  verifyHash!: string | null;

  @Column({ length: 64 })
  cancelHash!: string;
}
