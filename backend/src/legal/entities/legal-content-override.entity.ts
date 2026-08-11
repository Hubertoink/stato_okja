import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

const timestampType = (process.env.DB_TYPE || 'postgres').toLowerCase() === 'postgres'
  ? 'timestamptz'
  : 'datetime';

/** The one, deployment-wide set of legal texts maintained by the Superadmin. */
@Entity('legal_content_overrides')
export class LegalContentOverride {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  imprint!: string;

  @Column({ type: 'text' })
  privacy!: string;

  @Column({ type: 'text' })
  terms!: string;

  @Column({ type: 'varchar', length: 40 })
  termsVersion!: string;

  @Column({ type: timestampType, nullable: true })
  imprintUpdatedAt!: Date | null;

  @Column({ type: timestampType, nullable: true })
  privacyUpdatedAt!: Date | null;

  @Column({ type: timestampType, nullable: true })
  termsUpdatedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  @UpdateDateColumn({ type: timestampType })
  updatedAt!: Date;
}
