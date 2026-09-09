import { randomUUID } from 'crypto';
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

type UploadKind = 'image' | 'process-file';
type UploadAccess = {
  id: string;
  filename: string;
  kind: UploadKind;
  scopeKey: string;
  size: number;
  createdAt: Date;
};

function extractFilename(value: unknown, directory: 'images' | 'files') {
  const normalized = String(value || '').trim().replace(/\\/g, '/');
  if (!normalized) return null;
  const marker = `/uploads/${directory}/`;
  const markerIndex = normalized.indexOf(marker);
  const candidate = markerIndex >= 0
    ? normalized.slice(markerIndex + marker.length)
    : normalized.includes('/')
      ? ''
      : normalized;
  return /^[a-z0-9][a-z0-9_.-]*$/i.test(candidate) ? candidate : null;
}

function collectProcessFilenames(value: unknown, target: Set<string>) {
  if (typeof value === 'string') {
    const filename = extractFilename(value, 'files');
    if (filename && value.includes('/uploads/files/')) target.add(filename);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectProcessFilenames(entry, target));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((entry) => {
      collectProcessFilenames(entry, target);
    });
  }
}

export class StoredUploadScopes20260909120000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('stored_uploads'))) {
      await queryRunner.createTable(new Table({
        name: 'stored_uploads',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'filename', type: 'varchar', length: '255' },
          { name: 'kind', type: 'varchar', length: '20' },
          { name: 'scopeKey', type: 'varchar', length: '100' },
          { name: 'size', type: 'bigint', default: '0' },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }));
      await queryRunner.createIndex('stored_uploads', new TableIndex({
        name: 'IDX_stored_uploads_filename_kind_scope',
        columnNames: ['filename', 'kind', 'scopeKey'],
        isUnique: true,
      }));
      await queryRunner.createIndex('stored_uploads', new TableIndex({
        name: 'IDX_stored_uploads_scope',
        columnNames: ['scopeKey'],
      }));
    }

    await this.rebuild(queryRunner);
  }

  public async rebuild(queryRunner: QueryRunner): Promise<void> {
    const accessByKey = new Map<string, UploadAccess>();
    const addAccess = (filename: string | null, kind: UploadKind, scopeKey: string | null) => {
      if (!filename || !scopeKey) return;
      const key = `${filename}\0${kind}\0${scopeKey}`;
      if (!accessByKey.has(key)) {
        accessByKey.set(key, {
          id: randomUUID(),
          filename,
          kind,
          scopeKey,
          size: 0,
          createdAt: new Date(),
        });
      }
    };

    const imageSources: Array<{ query: string; scope: (row: Record<string, unknown>) => string | null }> = [
      {
        query: 'SELECT "imageUrl" AS "url", "orgId" FROM "projects" WHERE "imageUrl" IS NOT NULL',
        scope: (row) => row.orgId ? `org:${row.orgId}` : 'global',
      },
      {
        query: 'SELECT "imageUrl" AS "url", "orgId" FROM "project_templates" WHERE "imageUrl" IS NOT NULL',
        scope: (row) => row.orgId ? `org:${row.orgId}` : 'global',
      },
      {
        query: 'SELECT "bannerUrl" AS "url", "id" AS "orgId" FROM "organizations" WHERE "bannerUrl" IS NOT NULL',
        scope: (row) => `org:${row.orgId}`,
      },
    ];
    for (const source of imageSources) {
      const rows = await queryRunner.query(source.query) as Array<Record<string, unknown>>;
      rows.forEach((row) => addAccess(extractFilename(row.url, 'images'), 'image', source.scope(row)));
    }

    const memberships = await queryRunner.query(
      'SELECT "userId", "orgId" FROM "organization_memberships" WHERE "status" = \'active\'',
    ) as Array<{ userId: string; orgId: string }>;
    const membershipOrgIds = new Map<string, string[]>();
    memberships.forEach(({ userId, orgId }) => {
      membershipOrgIds.set(userId, [...(membershipOrgIds.get(userId) || []), orgId]);
    });
    const users = await queryRunner.query(
      'SELECT "id", "role", "orgId", "avatarUrl" AS "url" FROM "users" WHERE "avatarUrl" IS NOT NULL',
    ) as Array<{ id: string; role: string; orgId: string | null; url: string }>;
    users.forEach((user) => {
      const filename = extractFilename(user.url, 'images');
      if (user.role === 'superadmin') addAccess(filename, 'image', 'global');
      addAccess(filename, 'image', `user:${user.id}`);
      const orgIds = membershipOrgIds.get(user.id) || (user.orgId ? [user.orgId] : []);
      orgIds.forEach((orgId) => addAccess(filename, 'image', `org:${orgId}`));
    });

    const processes = await queryRunner.query(
      'SELECT "orgId", "definition" FROM "processes"',
    ) as Array<{ orgId: string | null; definition: unknown }>;
    processes.forEach((process) => {
      let definition = process.definition;
      if (typeof definition === 'string') {
        try { definition = JSON.parse(definition); } catch { return; }
      }
      const filenames = new Set<string>();
      collectProcessFilenames(definition, filenames);
      filenames.forEach((filename) => {
        addAccess(filename, 'process-file', process.orgId ? `org:${process.orgId}` : 'global');
      });
    });

    const rows = Array.from(accessByKey.values());
    for (let offset = 0; offset < rows.length; offset += 500) {
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into('stored_uploads')
        .values(rows.slice(offset, offset + 500))
        .orIgnore()
        .execute();
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('stored_uploads')) {
      await queryRunner.dropTable('stored_uploads', true);
    }
  }
}