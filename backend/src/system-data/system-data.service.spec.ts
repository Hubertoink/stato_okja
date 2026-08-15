import JSZip from 'jszip';
import { ForbiddenException } from '@nestjs/common';
import { tmpdir } from 'os';
import { join } from 'path';
import { rm, writeFile } from 'fs/promises';
import { Readable } from 'stream';
import { SystemDataService } from './system-data.service';
import { SystemDataImportArchiveReader } from './system-data-import-archive-reader';
import type { AuthService } from '../auth/auth.service';
import type { AuditService } from '../common/audit.service';

describe('SystemDataService', () => {
  const actor = { id: 'super-1', role: 'superadmin', name: 'Super Admin' };

  function createService() {
    const queryLog: string[] = [];
    const queryCalls: Array<{ sql: string; params?: unknown[] }> = [];
    const streamMetrics = { active: 0, maxActive: 0 };
    const projectImageRows: Array<{ id: string; title: string; orgId: string | null; imageUrl: string | null }> = [
      { id: 'project-1', title: 'Projekt Shared', orgId: 'org-1', imageUrl: '/uploads/images/shared.jpg' },
      { id: 'project-2', title: 'Nur Projekt', orgId: 'org-1', imageUrl: '/uploads/images/only-project.jpg' },
    ];
    const projectDocumentRows: Array<{ id: string; filename: string; projectId: string; projectTitle: string | null; orgId: string | null; storageRef: string | null }> = [
      { id: 'project-doc-1', filename: 'Konzeption Shared.pdf', projectId: 'project-1', projectTitle: 'Projekt Shared', orgId: 'org-1', storageRef: 'images/shared.jpg' },
    ];
    const templateImageRows: Array<{ id: string; title: string; orgId: string | null; imageUrl: string | null }> = [
      { id: 'template-1', title: 'Vorlage Shared', orgId: 'org-1', imageUrl: '/uploads/images/shared.jpg' },
    ];
    const userAvatarRows: Array<{ id: string; name: string | null; email: string; role: string; orgId: string | null; avatarUrl: string | null }> = [
      { id: 'user-1', name: 'Org Admin', email: 'user@example.com', role: 'org_admin', orgId: 'org-1', avatarUrl: '/uploads/images/shared.jpg' },
      { id: 'user-2', name: 'Legacy Avatar', email: 'legacy@example.com', role: 'user', orgId: 'org-1', avatarUrl: 'avatar-legacy.jpg' },
    ];
    const organizationBannerRows: Array<{ id: string; name: string; bannerUrl: string | null }> = [
      { id: 'org-1', name: 'Beispielstadt', bannerUrl: '/uploads/images/shared.jpg' },
    ];
    const queryRunner = {
      connect: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      commitTransaction: jest.fn(async () => undefined),
      rollbackTransaction: jest.fn(async () => undefined),
      getTables: jest.fn(async () => [
        { name: 'activities', foreignKeys: [{ referencedTableName: 'organizations' }] },
        { name: 'organizations', foreignKeys: [] },
        { name: 'users', foreignKeys: [{ referencedTableName: 'organizations' }] },
      ]),
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        queryLog.push(sql);
        queryCalls.push({ sql, params });
        if (sql === 'SELECT "id", "title", "orgId", "imageUrl" FROM "projects" WHERE "imageUrl" IS NOT NULL AND "imageUrl" != \'\'') {
          return projectImageRows.filter((row) => row.imageUrl);
        }
        if (sql === 'SELECT pd."id", pd."filename", pd."projectId", pd."storageRef", p."title" AS "projectTitle", p."orgId" FROM "project_documents" pd LEFT JOIN "projects" p ON p."id" = pd."projectId" WHERE pd."storageRef" IS NOT NULL AND pd."storageRef" != \'\'') {
          return projectDocumentRows.filter((row) => row.storageRef);
        }
        if (sql === 'SELECT "id", "title", "orgId", "imageUrl" FROM "project_templates" WHERE "imageUrl" IS NOT NULL AND "imageUrl" != \'\'') {
          return templateImageRows.filter((row) => row.imageUrl);
        }
        if (sql === 'SELECT "id", "name", "email", "role", "orgId", "avatarUrl" FROM "users" WHERE "avatarUrl" IS NOT NULL AND "avatarUrl" != \'\'') {
          return userAvatarRows.filter((row) => row.avatarUrl);
        }
        if (sql === 'SELECT "id", "name", "bannerUrl" FROM "organizations" WHERE "bannerUrl" IS NOT NULL AND "bannerUrl" != \'\'') {
          return organizationBannerRows.filter((row) => row.bannerUrl);
        }
        if (sql.startsWith('SELECT COUNT(*) AS count FROM "projects" WHERE "imageUrl" IN ')) {
          const matches = new Set((params || []).map((value) => String(value)));
          return [{ count: String(projectImageRows.filter((row) => row.imageUrl && matches.has(String(row.imageUrl))).length) }];
        }
        if (sql.startsWith('SELECT COUNT(*) AS count FROM "project_documents" WHERE "storageRef" IN ')) {
          const matches = new Set((params || []).map((value) => String(value)));
          return [{ count: String(projectDocumentRows.filter((row) => row.storageRef && matches.has(String(row.storageRef))).length) }];
        }
        if (sql.startsWith('SELECT COUNT(*) AS count FROM "project_templates" WHERE "imageUrl" IN ')) {
          const matches = new Set((params || []).map((value) => String(value)));
          return [{ count: String(templateImageRows.filter((row) => row.imageUrl && matches.has(String(row.imageUrl))).length) }];
        }
        if (sql.startsWith('SELECT COUNT(*) AS count FROM "users" WHERE "avatarUrl" IN ')) {
          const matches = new Set((params || []).map((value) => String(value)));
          return [{ count: String(userAvatarRows.filter((row) => row.avatarUrl && matches.has(String(row.avatarUrl))).length) }];
        }
        if (sql.startsWith('SELECT COUNT(*) AS count FROM "organizations" WHERE "bannerUrl" IN ')) {
          const matches = new Set((params || []).map((value) => String(value)));
          return [{ count: String(organizationBannerRows.filter((row) => row.bannerUrl && matches.has(String(row.bannerUrl))).length) }];
        }
        if (sql.startsWith('UPDATE "projects" SET "imageUrl" = ') && Array.isArray(params)) {
          const matches = new Set(params.slice(2).map((value) => String(value)));
          projectImageRows.forEach((row) => {
            if (row.imageUrl && matches.has(String(row.imageUrl))) row.imageUrl = null;
          });
          return [];
        }
        if (sql.startsWith('DELETE FROM "project_documents" WHERE "storageRef" IN ') && Array.isArray(params)) {
          const matches = new Set(params.map((value) => String(value)));
          for (let index = projectDocumentRows.length - 1; index >= 0; index -= 1) {
            if (projectDocumentRows[index].storageRef && matches.has(String(projectDocumentRows[index].storageRef))) {
              projectDocumentRows.splice(index, 1);
            }
          }
          return [];
        }
        if (sql.startsWith('UPDATE "project_templates" SET "imageUrl" = ') && Array.isArray(params)) {
          const matches = new Set(params.slice(1).map((value) => String(value)));
          templateImageRows.forEach((row) => {
            if (row.imageUrl && matches.has(String(row.imageUrl))) row.imageUrl = null;
          });
          return [];
        }
        if (sql.startsWith('UPDATE "users" SET "avatarUrl" = ') && Array.isArray(params)) {
          const matches = new Set(params.slice(1).map((value) => String(value)));
          userAvatarRows.forEach((row) => {
            if (row.avatarUrl && matches.has(String(row.avatarUrl))) row.avatarUrl = null;
          });
          return [];
        }
        if (sql.startsWith('UPDATE "organizations" SET "bannerUrl" = ') && Array.isArray(params)) {
          const matches = new Set(params.slice(1).map((value) => String(value)));
          organizationBannerRows.forEach((row) => {
            if (row.bannerUrl && matches.has(String(row.bannerUrl))) row.bannerUrl = null;
          });
          return [];
        }
        if (sql === 'SELECT * FROM "organizations"') {
          return [{ id: 'org-1', name: 'Beispielstadt', parentId: null, openingHours: null, closureDays: [{ date: '2026-04-17' }], taxonomySettings: null, childTaxonomyDefaults: null }];
        }
        if (sql === 'SELECT * FROM "users"') {
          return [
            { id: 'super-1', email: 'super@example.com', name: 'Super Admin', role: 'superadmin', orgId: null, theme: 'Default Theme', mustChangePassword: false, lockoutUntil: null },
            { id: 'user-1', email: 'user@example.com', name: 'Org Admin', role: 'org_admin', orgId: 'org-1', theme: 'Default Theme', mustChangePassword: false, lockoutUntil: null },
          ];
        }
        if (sql === 'SELECT * FROM "activities"') {
          return [{ id: 'activity-1', orgId: 'org-1', date: new Date(2026, 3, 17), executionStatus: 'cancelled', startTime: '10:00', endTime: '11:00', durationMinutes: 60, type: 'open_door', locationId: null, countMale: 1, countFemale: 2, countDiverse: 0, countTotal: 3, title: 'Offener Treff', cohorts: null, notes: 'Note', goals: 'Goal', createdById: null, updatedById: null, createdAt: '2026-04-01T10:00:00Z', updatedAt: '2026-04-01T10:00:00Z', ackDone: false, projectId: null }];
        }
        if (sql === 'SELECT id, email FROM "users" WHERE id = ?') {
          return [{ id: 'super-1', email: 'super@example.com' }];
        }
        if (sql.includes('FROM "activities"') && sql.includes('COUNT(*)')) return [{ count: '3' }];
        if (sql.includes('FROM "organizations"') && sql.includes('COUNT(*)')) return [{ count: '2' }];
        if (sql.includes('FROM "users"') && sql.includes(`role <> 'superadmin'`)) return [{ count: '4' }];
        if (sql.includes('FROM "users"') && sql.includes(`role = 'superadmin' AND "orgId" IS NOT NULL`)) return [{ count: '1' }];
        if (sql.includes('FROM "users"') && sql.includes(`role = 'superadmin' AND "avatarUrl" IS NOT NULL`)) return [{ count: '1' }];
        if (sql.includes('FROM "users"') && sql.includes('id <> ?')) return [{ count: '1' }];
        if (sql.includes('SELECT id, email, name FROM "users" WHERE role = ')) {
          return [{ id: 'super-1', email: 'super@example.com', name: 'Super Admin' }];
        }
        if (sql.includes('COUNT(*)')) return [{ count: '0' }];
        return [];
      }),
      stream: jest.fn(async (sql: string) => {
        const rows = await queryRunner.query(sql) as Array<Record<string, unknown>>;
        return Readable.from((async function* () {
          streamMetrics.active += 1;
          streamMetrics.maxActive = Math.max(streamMetrics.maxActive, streamMetrics.active);
          try {
            for (const row of rows) {
              await new Promise<void>((resolve) => setTimeout(resolve, 1));
              yield row;
            }
          } finally {
            streamMetrics.active -= 1;
          }
        })());
      }),
    };

    const dataSource = {
      options: { type: 'sqlite' },
      entityMetadatas: [
        { tableName: 'users', tablePath: 'users', relations: [], columns: [] },
        { tableName: 'auth_refresh_sessions', tablePath: 'auth_refresh_sessions', relations: [], columns: [] },
        { tableName: 'organizations', tablePath: 'organizations', relations: [], columns: [{ databaseName: 'closureDays', type: 'simple-json' }] },
        {
          tableName: 'activities',
          tablePath: 'activities',
          relations: [],
          columns: [
            { databaseName: 'date', type: 'date' },
            { databaseName: 'executionStatus', type: 'varchar' },
          ],
        },
      ],
      createQueryRunner: jest.fn(() => queryRunner),
    };

    const authService = {
      verifyPasswordForUser: jest.fn(async () => true),
    } as unknown as AuthService;

    const auditService = {
      log: jest.fn(async () => undefined),
    } as unknown as AuditService;

    const service = new SystemDataService(dataSource as any, authService, auditService);
    const uploadStore = (service as any).uploadStore;
    const importArchiveReader = (service as any).importArchiveReader;
    return { service, dataSource, queryRunner, queryLog, queryCalls, streamMetrics, authService, auditService, uploadStore, importArchiveReader };
  }

  it('rejects purge when password verification fails', async () => {
    const { service, authService } = createService();
    jest.spyOn(authService, 'verifyPasswordForUser').mockResolvedValue(false as never);

    await expect(
      service.purgeAllData(actor, {
        password: 'wrong',
        confirmationText: 'ALLE DATEN LOESCHEN',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deletes dependent tables before parents and preserves superadmins', async () => {
    const { service, queryLog, auditService, uploadStore } = createService();
    jest.spyOn(uploadStore, 'clearUploads').mockResolvedValue({
      deletedFiles: 0,
      deletedBytes: 0,
      warnings: [],
    });

    const result = await service.purgeAllData(actor, {
      password: 'correct',
      confirmationText: 'ALLE DATEN LOESCHEN',
    });

    const deleteActivitiesIndex = queryLog.findIndex((sql) => sql === 'DELETE FROM "activities"');
    const deleteOrganizationsIndex = queryLog.findIndex((sql) => sql === 'DELETE FROM "organizations"');
    const deleteUsersIndex = queryLog.findIndex((sql) => sql === 'DELETE FROM "users" WHERE role <> ' + "'superadmin'");

    expect(deleteActivitiesIndex).toBeGreaterThan(-1);
    expect(deleteOrganizationsIndex).toBeGreaterThan(deleteActivitiesIndex);
    expect(deleteUsersIndex).toBeGreaterThan(deleteOrganizationsIndex);
    expect(queryLog).toContain(`SELECT COUNT(*) AS count FROM "users" WHERE role = 'superadmin' AND "orgId" IS NOT NULL`);
    expect(queryLog).toContain(`UPDATE "users" SET "orgId" = NULL WHERE role = 'superadmin' AND "orgId" IS NOT NULL`);
    expect(queryLog).toContain(`UPDATE "users" SET "avatarUrl" = NULL WHERE role = 'superadmin' AND "avatarUrl" IS NOT NULL`);
    expect(queryLog).not.toContain('DELETE FROM "auth_refresh_sessions"');
    expect(result.deletedUsers).toBe(4);
    expect(result.preservedSuperadmins).toEqual([
      { id: 'super-1', email: 'super@example.com', name: 'Super Admin' },
    ]);
    expect(auditService.log).toHaveBeenCalled();
  });

  it('streams database rows into the export zip', async () => {
    const { service, dataSource, auditService, uploadStore, queryRunner, streamMetrics } = createService();
    jest.spyOn(uploadStore, 'scanUploads').mockResolvedValue({
      files: [],
      fileCount: 0,
      totalBytes: 0,
      warnings: [],
    });
    dataSource.options.type = 'postgres';

    const result = await service.exportAllData(actor);
    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const zip = await JSZip.loadAsync(Buffer.concat(chunks));
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')) as { format?: string; schemaVersion?: number };
    const activities = JSON.parse(await zip.file('database/activities.json')!.async('string')) as Array<{ date: string; executionStatus?: string }>;
    const organizations = JSON.parse(await zip.file('database/organizations.json')!.async('string')) as Array<{ closureDays?: unknown }>;

    expect(Object.keys(zip.files)).toContain('manifest.json');
    expect(result).not.toHaveProperty('buffer');
    expect(queryRunner.stream).toHaveBeenCalled();
    expect(streamMetrics.maxActive).toBe(1);
    expect(manifest.format).toBe('stato-system-data-export');
    expect(manifest.schemaVersion).toBe(3);
    expect(zip.file('database/auth_refresh_sessions.json')).toBeNull();
    expect(activities[0]?.date).toBe('2026-04-17');
    expect(activities[0]?.executionStatus).toBe('cancelled');
    expect(organizations[0]?.closureDays).toEqual([{ date: '2026-04-17' }]);
    expect(auditService.log).toHaveBeenCalled();
  });

  it('includes every scanned upload file in the export zip', async () => {
    const { service, uploadStore } = createService();
    const tempFile = join(tmpdir(), `stato-export-upload-${Date.now()}.txt`);
    await writeFile(tempFile, 'backup-content');
    jest.spyOn(uploadStore, 'scanUploads').mockResolvedValue({
      files: [{ absolutePath: tempFile, relativePath: 'project-documents/backup.txt', size: 14 }],
      fileCount: 1,
      totalBytes: 14,
      warnings: [],
    });

    try {
      const result = await service.exportAllData(actor);
      const chunks: Buffer[] = [];
      for await (const chunk of result.stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const zip = await JSZip.loadAsync(Buffer.concat(chunks));

      expect(await zip.file('uploads/project-documents/backup.txt')?.async('string')).toBe('backup-content');
      const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')) as {
        totals?: { uploadFiles?: number; uploadBytes?: number };
      };
      expect(manifest.totals).toMatchObject({ uploadFiles: 1, uploadBytes: 14 });
    } finally {
      await rm(tempFile, { force: true });
    }
  });

  it('returns an import preview for a valid backup archive', async () => {
    const { service, importArchiveReader, uploadStore } = createService();
    jest.spyOn(importArchiveReader, 'read').mockResolvedValue({
      originalFilename: 'backup.zip',
      manifest: { generatedAt: '2026-04-17T10:00:00.000Z', generatedBy: { id: 'super-1', name: 'Super Admin', role: 'superadmin' } },
      warnings: ['Archiv ohne Schema-Version erkannt. Es wird als Legacy-Export behandelt.'],
      tables: [
        { key: 'organizations', path: 'organizations', filename: 'organizations', rows: [{ id: 'org-1' }] },
        { key: 'users', path: 'users', filename: 'users', rows: [{ id: 'super-1' }, { id: 'user-1' }] },
      ],
      uploads: [],
    });
    jest.spyOn(uploadStore, 'removePath').mockResolvedValue(undefined);

    const result = await service.inspectImportArchive(actor, 'C:/temp/backup.zip', 'backup.zip');

    expect(result.filename).toBe('backup.zip');
    expect(result.totals.databaseRows).toBe(3);
    expect(result.confirmationText).toBe('BACKUP IMPORTIEREN');
    expect(result.warnings).toHaveLength(1);
  });

  it('normalizes legacy ISO timestamps in date-only columns when reading an import archive', async () => {
    const { service } = createService();
    const zip = new JSZip();
    const legacyExportDate = new Date(2026, 3, 17).toJSON();
    const tempZipPath = join(tmpdir(), `stato-system-data-${Date.now()}.zip`);

    zip.file('manifest.json', JSON.stringify({ format: 'stato-system-data-export', schemaVersion: 1, tables: [{ tableName: 'activities', rowCount: 1, files: ['database/activities.json'] }, { tableName: 'organizations', rowCount: 0, files: ['database/organizations.json'] }, { tableName: 'users', rowCount: 0, files: ['database/users.json'] }] }));
    zip.file('database/activities.json', JSON.stringify([{ id: 'activity-1', date: legacyExportDate, type: 'open_door' }]));
    zip.file('database/organizations.json', JSON.stringify([]));
    zip.file('database/users.json', JSON.stringify([]));

    await writeFile(tempZipPath, await zip.generateAsync({ type: 'nodebuffer' }));

    try {
      const archive = await new SystemDataImportArchiveReader().read({
        filePath: tempZipPath,
        originalFilename: 'legacy.zip',
        managedTables: (service as any).getManagedTables(),
        exportFormat: 'stato-system-data-export',
        schemaVersion: 2,
        normalizeRowsForImport: (table, rows) => (service as any).normalizeRowsForImport(table, rows),
      });
      const activities = archive.tables.find((table: { key: string }) => table.key === 'activities');

      if (!activities) throw new Error('activities table missing from archive');
      expect(activities.rows[0]?.date).toBe('2026-04-17');
      expect(activities.rows[0]?.executionStatus).toBe('completed');
    } finally {
      await rm(tempZipPath, { force: true });
    }
  });

  it('restores backup data in dependency-safe order', async () => {
    const { service, queryLog, queryCalls, auditService, queryRunner, uploadStore, importArchiveReader } = createService();
    jest.spyOn(importArchiveReader, 'read').mockResolvedValue({
      originalFilename: 'backup.zip',
      manifest: {},
      warnings: [],
      tables: [
        {
          key: 'organizations',
          path: 'organizations',
          filename: 'organizations',
          rows: [{ id: 'org-1', name: 'Imported Org', parentId: null, openingHours: null, taxonomySettings: null, childTaxonomyDefaults: null }],
        },
        {
          key: 'users',
          path: 'users',
          filename: 'users',
          rows: [
            { id: 'super-1', email: 'super@example.com', name: 'Super Admin', role: 'superadmin', orgId: 'org-1', theme: 'Default Theme', passwordHash: null, mustChangePassword: false },
            { id: 'user-2', email: 'imported@example.com', name: 'Imported User', role: 'user', orgId: 'org-1', theme: 'Default Theme', passwordHash: null, mustChangePassword: false },
          ],
        },
        {
          key: 'activities',
          path: 'activities',
          filename: 'activities',
          columnTypes: { date: 'date' },
          rows: [{ id: 'activity-1', orgId: 'org-1', date: '2026-04-17', startTime: '10:00', endTime: '11:00', durationMinutes: 60, type: 'open_door' }],
        },
      ],
      uploads: [],
    });
    jest.spyOn(uploadStore, 'stageImportedUploads').mockResolvedValue({
      sessionRoot: 'C:/temp/import-session',
      uploadsRoot: 'C:/temp/import-session/uploads',
      fileCount: 0,
      totalBytes: 0,
    });
    jest.spyOn(uploadStore, 'applyImportedUploads').mockResolvedValue({
      backupRoot: null,
      uploadsRoot: 'C:/uploads',
    });
    jest.spyOn(uploadStore, 'removePath').mockResolvedValue(undefined);
    jest.spyOn(uploadStore, 'restorePreviousUploads').mockResolvedValue(undefined);

    const result = await service.importAllData(actor, 'C:/temp/backup.zip', {
      originalFilename: 'backup.zip',
      password: 'correct',
      confirmationText: 'BACKUP IMPORTIEREN',
    });

    const deleteOrganizationsIndex = queryLog.findIndex((sql) => sql === 'DELETE FROM "organizations"');
    const insertOrganizationsIndex = queryLog.findIndex((sql) => sql.startsWith('INSERT INTO "organizations"'));
    const insertActivitiesIndex = queryLog.findIndex((sql) => sql.startsWith('INSERT INTO "activities"'));
    const insertUsersIndex = queryLog.findIndex((sql) => sql.startsWith('INSERT INTO "users"'));
    const insertActivitiesCall = queryCalls.find((call) => call.sql.startsWith('INSERT INTO "activities"'));
    const insertUsersCall = queryCalls.find((call) => call.sql.startsWith('INSERT INTO "users"'));

    expect(deleteOrganizationsIndex).toBeGreaterThan(-1);
    expect(insertOrganizationsIndex).toBeGreaterThan(-1);
    expect(insertActivitiesIndex).toBeGreaterThan(insertOrganizationsIndex);
    expect(insertUsersIndex).toBeGreaterThan(insertOrganizationsIndex);
    expect(queryLog).not.toContain('DELETE FROM "users"');
    expect(queryLog).toContain('DELETE FROM "users" WHERE id <> ?');
    expect(queryLog).not.toContain('DELETE FROM "auth_refresh_sessions"');
    expect(insertUsersCall?.params).toContain('imported@example.com');
    expect(insertUsersCall?.params).not.toContain('super@example.com');
    expect(insertActivitiesCall?.params).toContain('2026-04-17');
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(result.importedTables).toHaveLength(3);
    expect(auditService.log).toHaveBeenCalled();
  });

  it('lists uploads with aggregated reference counts', async () => {
    const { service, uploadStore } = createService();
    jest.spyOn(uploadStore, 'scanUploads').mockResolvedValue({
      files: [
        { absolutePath: 'C:/uploads/images/shared.jpg', relativePath: 'images/shared.jpg', size: 1234 },
        { absolutePath: 'C:/uploads/images/unused.jpg', relativePath: 'images/unused.jpg', size: 567 },
      ],
      fileCount: 2,
      totalBytes: 1801,
      warnings: [],
    });

    const result = await service.listUploads(actor);

    expect(result.uploads[0]).toMatchObject({
      relativePath: 'images/shared.jpg',
      referenceCount: 5,
      referenceBreakdown: { projects: 1, projectDocuments: 1, projectTemplates: 1, userAvatars: 1, organizationBanners: 1 },
      referenceDetails: {
        projects: [{ id: 'project-1', title: 'Projekt Shared', orgId: 'org-1' }],
        projectDocuments: [{ id: 'project-doc-1', filename: 'Konzeption Shared.pdf', projectId: 'project-1', projectTitle: 'Projekt Shared', orgId: 'org-1' }],
        projectTemplates: [{ id: 'template-1', title: 'Vorlage Shared', orgId: 'org-1' }],
        userAvatars: [{ id: 'user-1', name: 'Org Admin', email: 'user@example.com', role: 'org_admin', orgId: 'org-1' }],
        organizationBanners: [{ id: 'org-1', name: 'Beispielstadt' }],
      },
    });
    expect(result.uploads[1]).toMatchObject({
      relativePath: 'images/unused.jpg',
      referenceCount: 0,
    });
  });

  it('deletes an upload and clears known references before unlinking the file', async () => {
    const { service, auditService, queryLog } = createService();
    const unlinkSpy = jest.spyOn(require('fs/promises'), 'unlink').mockResolvedValue(undefined);
    const statSpy = jest.spyOn(require('fs/promises'), 'stat').mockResolvedValue({
      isFile: () => true,
      size: 2048,
    } as any);

    try {
      const result = await service.deleteUpload(actor, 'images/shared.jpg');

      expect(result).toMatchObject({
        relativePath: 'images/shared.jpg',
        deleted: true,
        deletedBytes: 2048,
        clearedReferences: 5,
        referenceBreakdown: { projects: 1, projectDocuments: 1, projectTemplates: 1, userAvatars: 1, organizationBanners: 1 },
      });
      expect(queryLog).toContain('UPDATE "projects" SET "imageUrl" = ?, "imageSize" = ? WHERE "imageUrl" IN (?, ?, ?, ?)');
      expect(queryLog).toContain('DELETE FROM "project_documents" WHERE "storageRef" IN (?, ?, ?, ?)');
      expect(queryLog).toContain('UPDATE "project_templates" SET "imageUrl" = ? WHERE "imageUrl" IN (?, ?, ?, ?)');
      expect(queryLog).toContain('UPDATE "users" SET "avatarUrl" = ? WHERE "avatarUrl" IN (?, ?, ?, ?)');
      expect(queryLog).toContain('UPDATE "organizations" SET "bannerUrl" = ? WHERE "bannerUrl" IN (?, ?, ?, ?)');
      expect(unlinkSpy).toHaveBeenCalledWith(expect.stringContaining('images'));
      expect(auditService.log).toHaveBeenCalled();
    } finally {
      unlinkSpy.mockRestore();
      statSpy.mockRestore();
    }
  });

  it('deletes an unreferenced upload without failing reference cleanup', async () => {
    const { service, auditService } = createService();
    const unlinkSpy = jest.spyOn(require('fs/promises'), 'unlink').mockResolvedValue(undefined);
    const statSpy = jest.spyOn(require('fs/promises'), 'stat').mockResolvedValue({
      isFile: () => true,
      size: 512,
    } as any);

    try {
      const result = await service.deleteUpload(actor, 'images/unused.jpg');

      expect(result).toMatchObject({
        relativePath: 'images/unused.jpg',
        deleted: true,
        deletedBytes: 512,
        clearedReferences: 0,
        referenceBreakdown: { projects: 0, projectDocuments: 0, projectTemplates: 0, userAvatars: 0 },
      });
      expect(unlinkSpy).toHaveBeenCalledWith(expect.stringContaining('images'));
      expect(auditService.log).toHaveBeenCalled();
    } finally {
      unlinkSpy.mockRestore();
      statSpy.mockRestore();
    }
  });

  it('retries transient Windows-style file lock errors when deleting uploads', async () => {
    const { service } = createService();
    const unlinkSpy = jest.spyOn(require('fs/promises'), 'unlink')
      .mockRejectedValueOnce(Object.assign(new Error('busy'), { code: 'EPERM' }))
      .mockResolvedValue(undefined);
    const statSpy = jest.spyOn(require('fs/promises'), 'stat').mockResolvedValue({
      isFile: () => true,
      size: 1024,
    } as any);

    try {
      const result = await service.deleteUpload(actor, 'images/unused.jpg');

      expect(result.deleted).toBe(true);
      expect(unlinkSpy).toHaveBeenCalledTimes(2);
    } finally {
      unlinkSpy.mockRestore();
      statSpy.mockRestore();
    }
  });
});
