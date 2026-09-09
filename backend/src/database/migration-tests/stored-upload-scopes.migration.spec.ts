import { DataSource } from 'typeorm';
import { StoredUploadScopes20260909120000 } from '../migrations/20260909120000-stored-upload-scopes';

describe('StoredUploadScopes20260909120000', () => {
  it('backfills organization images, multi-membership avatars and process files', async () => {
    const dataSource = new DataSource({ type: 'sqljs', entities: [], synchronize: false });
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.query('CREATE TABLE "projects" ("imageUrl" text, "orgId" text)');
      await queryRunner.query('CREATE TABLE "project_templates" ("imageUrl" text, "orgId" text)');
      await queryRunner.query('CREATE TABLE "organizations" ("id" text, "bannerUrl" text)');
      await queryRunner.query('CREATE TABLE "users" ("id" text, "role" text, "orgId" text, "avatarUrl" text)');
      await queryRunner.query('CREATE TABLE "organization_memberships" ("userId" text, "orgId" text, "status" text)');
      await queryRunner.query('CREATE TABLE "processes" ("orgId" text, "definition" text)');
      await queryRunner.query(
        'INSERT INTO "projects" VALUES (?, ?)',
        ['/uploads/images/project.jpg', 'org-1'],
      );
      await queryRunner.query(
        'INSERT INTO "users" VALUES (?, ?, ?, ?)',
        ['user-1', 'user', 'org-1', '/uploads/images/avatar.jpg'],
      );
      await queryRunner.query(
        'INSERT INTO "organization_memberships" VALUES (?, ?, ?), (?, ?, ?)',
        ['user-1', 'org-1', 'active', 'user-1', 'org-2', 'active'],
      );
      await queryRunner.query(
        'INSERT INTO "processes" VALUES (?, ?)',
        ['org-2', JSON.stringify({ nodes: [{ data: { fileUrl: '/uploads/files/plan.pdf' } }] })],
      );

      await new StoredUploadScopes20260909120000().up(queryRunner);
      await new StoredUploadScopes20260909120000().up(queryRunner);

      const rows = await queryRunner.query(
        'SELECT "filename", "kind", "scopeKey" FROM "stored_uploads" ORDER BY "filename", "scopeKey"',
      );
      expect(rows).toEqual([
        { filename: 'avatar.jpg', kind: 'image', scopeKey: 'org:org-1' },
        { filename: 'avatar.jpg', kind: 'image', scopeKey: 'org:org-2' },
        { filename: 'avatar.jpg', kind: 'image', scopeKey: 'user:user-1' },
        { filename: 'plan.pdf', kind: 'process-file', scopeKey: 'org:org-2' },
        { filename: 'project.jpg', kind: 'image', scopeKey: 'org:org-1' },
      ]);
    } finally {
      await queryRunner.release();
      await dataSource.destroy();
    }
  });
});