import { NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { LogbookEntry } from '../logbook/entities/logbook-entry.entity';
import { LogbookComment } from '../logbook/entities/logbook-comment.entity';
import { ProjectTemplate } from '../project-templates/entities/project-template.entity';
import { LogbookVisibility } from '../common/enums';
import { StoredUpload } from './stored-upload.entity';
import { UploadsService } from './uploads.service';

// Minimal SQL schemas exercise the real access query without unrelated
// PostgreSQL-only application columns (enums and virtual columns).
const schemas = [
  new EntitySchema<User>({ name: 'User', target: User, columns: {
    id: { type: String, primary: true }, role: { type: String }, avatarUrl: { type: String, nullable: true },
  } }),
  new EntitySchema<LogbookEntry>({ name: 'LogbookEntry', target: LogbookEntry, columns: {
    id: { type: String, primary: true }, orgId: { type: String }, createdByUserId: { type: String }, visibility: { type: String },
  }, relations: { comments: { type: 'one-to-many', target: 'LogbookComment', inverseSide: 'entry' } } }),
  new EntitySchema<LogbookComment>({ name: 'LogbookComment', target: LogbookComment, columns: {
    id: { type: String, primary: true }, entryId: { type: String }, createdByUserId: { type: String },
  }, relations: { entry: { type: 'many-to-one', target: 'LogbookEntry', joinColumn: { name: 'entryId' } } } }),
  new EntitySchema<ProjectTemplate>({ name: 'ProjectTemplate', target: ProjectTemplate, columns: {
    id: { type: String, primary: true }, orgId: { type: String, nullable: true }, archived: { type: Boolean }, imageUrl: { type: String, nullable: true },
  } }),
];

describe('Superadmin avatars on visible logbook records', () => {
  let db: DataSource;
  let service: UploadsService;
  const reader = { id: 'reader', role: 'user' };

  beforeEach(async () => {
    db = await new DataSource({ type: 'sqljs', entities: [StoredUpload, ...schemas], synchronize: true }).initialize();
    service = new UploadsService(db.getRepository(StoredUpload), { getAncestorOrgIds: async () => [] } as never);
    await db.getRepository(User).insert({ id: 'super', role: 'superadmin', avatarUrl: '/uploads/images/super.jpg' });
    await db.getRepository(StoredUpload).insert({ filename: 'super.jpg', kind: 'image', scopeKey: 'global', size: 10 });
    await db.getRepository(LogbookEntry).insert({ id: 'entry', orgId: 'org-1', createdByUserId: 'super', visibility: LogbookVisibility.TEAM });
  });

  afterEach(async () => { await db?.destroy(); });

  it('allows the current avatar of a superadmin who authored a visible entry', async () => {
    await expect(service.assertCanRead('super.jpg', 'image', reader, 'org-1')).resolves.toBeUndefined();
  });

  it('does not expose it through an entry in another organization or without a scope', async () => {
    await expect(service.assertCanRead('super.jpg', 'image', reader, 'org-2')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.assertCanRead('super.jpg', 'image', reader, null)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('respects admin-only visibility for users and editors while allowing org admins', async () => {
    await db.getRepository(LogbookEntry).update('entry', { visibility: LogbookVisibility.ADMINS });
    for (const role of ['user', 'editor']) {
      await expect(service.assertCanRead('super.jpg', 'image', { ...reader, role }, 'org-1')).rejects.toBeInstanceOf(NotFoundException);
    }
    await expect(service.assertCanRead('super.jpg', 'image', { ...reader, role: 'org_admin' }, 'org-1')).resolves.toBeUndefined();
  });

  it('allows comment authors only through entries visible to this reader', async () => {
    await db.getRepository(LogbookEntry).update('entry', { createdByUserId: 'reader', visibility: LogbookVisibility.ADMINS });
    await db.getRepository(LogbookComment).insert({ id: 'comment', entryId: 'entry', createdByUserId: 'super' });
    await expect(service.assertCanRead('super.jpg', 'image', reader, 'org-1')).resolves.toBeUndefined();
    await expect(service.assertCanRead('super.jpg', 'image', { id: 'other', role: 'user' }, 'org-1')).rejects.toBeInstanceOf(NotFoundException);
    await db.getRepository(LogbookEntry).update('entry', { visibility: LogbookVisibility.TEAM });
    await expect(service.assertCanRead('super.jpg', 'image', { id: 'other', role: 'user' }, 'org-1')).resolves.toBeUndefined();
  });

  it('does not grant access to other global uploads or unregistered avatars', async () => {
    await db.getRepository(StoredUpload).insert({ filename: 'private.jpg', kind: 'image', scopeKey: 'global', size: 10 });
    await expect(service.assertCanRead('private.jpg', 'image', reader, 'org-1')).rejects.toBeInstanceOf(NotFoundException);
    await db.getRepository(StoredUpload).delete({ filename: 'super.jpg' });
    await expect(service.assertCanRead('super.jpg', 'image', reader, 'org-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('supports existing filename-only avatar values and revokes old avatar URLs on replacement', async () => {
    await db.getRepository(User).update('super', { avatarUrl: 'super.jpg' });
    await expect(service.assertCanRead('super.jpg', 'image', reader, 'org-1')).resolves.toBeUndefined();
    await db.getRepository(User).update('super', { avatarUrl: '/uploads/images/new.jpg' });
    await expect(service.assertCanRead('super.jpg', 'image', reader, 'org-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
