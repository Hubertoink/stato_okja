import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('stored_uploads')
@Index('IDX_stored_uploads_filename_kind_scope', ['filename', 'kind', 'scopeKey'], { unique: true })
@Index('IDX_stored_uploads_scope', ['scopeKey'])
export class StoredUpload {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  filename!: string;

  @Column({ length: 20 })
  kind!: 'image' | 'process-file';

  @Column({ length: 100 })
  scopeKey!: string;

  @Column({ type: 'bigint', default: 0 })
  size!: number;

  @CreateDateColumn()
  createdAt!: Date;
}