import JSZip from 'jszip';
import { ForbiddenException } from '@nestjs/common';
import { tmpdir } from 'os';
import { join } from 'path';
import { rm, writeFile } from 'fs/promises';
import { SystemDataService } from './system-data.service';
import type { AuthService } from '../auth/auth.service';
import type { AuditService } from '../common/audit.service';

describe('SystemDataService', () => {
  const actor = { id: 'super-1', role: 'superadmin', name: 'Super Admin' };

  function createService() {
    const queryLog: string[] = [];
    const queryCalls: Array<{ sql: string; params?: unknown[] }> = [];
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
        if (sql === 'SELECT * FROM "organizations"') {
          return [{ id: 'org-1', name: 'Beispielstadt', parentId: null, openingHours: null, taxonomySettings: null, childTaxonomyDefaults: null }];
        }
        if (sql === 'SELECT * FROM "users"') {
          return [
            { id: 'super-1', email: 'super@example.com', name: 'Super Admin', role: 'superadmin', orgId: null, theme: 'Default Theme', mustChangePassword: false, lockoutUntil: null },
            { id: 'user-1', email: 'user@example.com', name: 'Org Admin', role: 'org_admin', orgId: 'org-1', theme: 'Default Theme', mustChangePassword: false, lockoutUntil: null },
          ];
        }
        if (sql === 'SELECT * FROM "activities"') {
          return [{ id: 'activity-1', orgId: 'org-1', date: new Date(2026, 3, 17), startTime: '10:00', endTime: '11:00', durationMinutes: 60, type: 'open_door', locationId: null, countMale: 1, countFemale: 2, countDiverse: 0, countTotal: 3, title: 'Offener Treff', cohorts: null, notes: 'Note', goals: 'Goal', createdById: null, updatedById: null, createdAt: '2026-04-01T10:00:00Z', updatedAt: '2026-04-01T10:00:00Z', ackDone: false, projectId: null }];
        }
        if (sql.includes('FROM "activities"') && sql.includes('COUNT(*)')) return [{ count: '3' }];
        if (sql.includes('FROM "organizations"') && sql.includes('COUNT(*)')) return [{ count: '2' }];
        if (sql.includes('FROM "users"') && sql.includes(`role <> 'superadmin'`)) return [{ count: '4' }];
        if (sql.includes('FROM "users"') && sql.includes(`role = 'superadmin' AND "orgId" IS NOT NULL`)) return [{ count: '1' }];
        if (sql.includes('SELECT id, email, name FROM "users" WHERE role = ')) {
          return [{ id: 'super-1', email: 'super@example.com', name: 'Super Admin' }];
        }
        if (sql.includes('COUNT(*)')) return [{ count: '0' }];
        return [];
      }),
    };

    const dataSource = {
      entityMetadatas: [
        { tableName: 'users', tablePath: 'users', relations: [], columns: [] },
        { tableName: 'organizations', tablePath: 'organizations', relations: [], columns: [] },
        {
          tableName: 'activities',
          tablePath: 'activities',
          relations: [],
          columns: [
            { databaseName: 'date', type: 'date' },
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
    return { service, queryRunner, queryLog, queryCalls, authService, auditService };
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
    const { service, queryLog, auditService } = createService();
    jest.spyOn(service as never, 'clearUploads' as never).mockResolvedValue({
      deletedFiles: 0,
      deletedBytes: 0,
      warnings: [],
    } as never);

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
    expect(result.deletedUsers).toBe(4);
    expect(result.preservedSuperadmins).toEqual([
      { id: 'super-1', email: 'super@example.com', name: 'Super Admin' },
    ]);
    expect(auditService.log).toHaveBeenCalled();
  });

  it('includes a readable workbook in the export zip', async () => {
    const { service, auditService } = createService();
    jest.spyOn(service as never, 'scanUploads' as never).mockResolvedValue({
      files: [],
      fileCount: 0,
      totalBytes: 0,
      warnings: [],
    } as never);

    const result = await service.exportAllData(actor);
    const zip = await JSZip.loadAsync(result.buffer);
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')) as { format?: string; schemaVersion?: number };
    const activities = JSON.parse(await zip.file('database/activities.json')!.async('string')) as Array<{ date: string }>;

    expect(Object.keys(zip.files)).toContain('readable/stato-system-data-readable.xlsx');
    expect(Object.keys(zip.files)).toContain('manifest.json');
    expect(manifest.format).toBe('stato-system-data-export');
    expect(manifest.schemaVersion).toBe(2);
    expect(activities[0]?.date).toBe('2026-04-17');
    expect(auditService.log).toHaveBeenCalled();
  });

  it('returns an import preview for a valid backup archive', async () => {
    const { service } = createService();
    jest.spyOn(service as never, 'readImportArchive' as never).mockResolvedValue({
      originalFilename: 'backup.zip',
      manifest: { generatedAt: '2026-04-17T10:00:00.000Z', generatedBy: { id: 'super-1', name: 'Super Admin', role: 'superadmin' } },
      warnings: ['Archiv ohne Schema-Version erkannt. Es wird als Legacy-Export behandelt.'],
      tables: [
        { key: 'organizations', path: 'organizations', filename: 'organizations', rows: [{ id: 'org-1' }] },
        { key: 'users', path: 'users', filename: 'users', rows: [{ id: 'super-1' }, { id: 'user-1' }] },
      ],
      uploads: [],
    } as never);
    jest.spyOn(service as never, 'removePath' as never).mockResolvedValue(undefined as never);

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
      const archive = await (service as any).readImportArchive(tempZipPath, 'legacy.zip');
      const activities = archive.tables.find((table: { key: string }) => table.key === 'activities');

      expect(activities.rows[0]?.date).toBe('2026-04-17');
    } finally {
      await rm(tempZipPath, { force: true });
    }
  });

  it('restores backup data in dependency-safe order', async () => {
    const { service, queryLog, queryCalls, auditService, queryRunner } = createService();
    jest.spyOn(service as never, 'readImportArchive' as never).mockResolvedValue({
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
          rows: [{ id: 'super-1', email: 'super@example.com', name: 'Super Admin', role: 'superadmin', orgId: 'org-1', theme: 'Default Theme', passwordHash: null, mustChangePassword: false }],
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
    } as never);
    jest.spyOn(service as never, 'stageImportedUploads' as never).mockResolvedValue({
      sessionRoot: 'C:/temp/import-session',
      uploadsRoot: 'C:/temp/import-session/uploads',
      fileCount: 0,
      totalBytes: 0,
    } as never);
    jest.spyOn(service as never, 'applyImportedUploads' as never).mockResolvedValue({
      backupRoot: null,
      uploadsRoot: 'C:/uploads',
    } as never);
    jest.spyOn(service as never, 'removePath' as never).mockResolvedValue(undefined as never);
    jest.spyOn(service as never, 'restorePreviousUploads' as never).mockResolvedValue(undefined as never);

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

    expect(deleteOrganizationsIndex).toBeGreaterThan(-1);
    expect(insertOrganizationsIndex).toBeGreaterThan(-1);
    expect(insertActivitiesIndex).toBeGreaterThan(insertOrganizationsIndex);
    expect(insertUsersIndex).toBeGreaterThan(insertOrganizationsIndex);
    expect(insertActivitiesCall?.params).toContain('2026-04-17');
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(result.importedTables).toHaveLength(3);
    expect(auditService.log).toHaveBeenCalled();
  });
});