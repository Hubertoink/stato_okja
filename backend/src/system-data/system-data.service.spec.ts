import JSZip from 'jszip';
import { ForbiddenException } from '@nestjs/common';
import { SystemDataService } from './system-data.service';
import type { AuthService } from '../auth/auth.service';
import type { AuditService } from '../common/audit.service';

describe('SystemDataService', () => {
  const actor = { id: 'super-1', role: 'superadmin', name: 'Super Admin' };

  function createService() {
    const queryLog: string[] = [];
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
      query: jest.fn(async (sql: string) => {
        queryLog.push(sql);
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
          return [{ id: 'activity-1', orgId: 'org-1', date: '2026-04-01', startTime: '10:00', endTime: '11:00', durationMinutes: 60, type: 'open_door', locationId: null, countMale: 1, countFemale: 2, countDiverse: 0, countTotal: 3, title: 'Offener Treff', cohorts: null, notes: 'Note', goals: 'Goal', createdById: null, updatedById: null, createdAt: '2026-04-01T10:00:00Z', updatedAt: '2026-04-01T10:00:00Z', ackDone: false, projectId: null }];
        }
        if (sql.includes('FROM "activities"') && sql.includes('COUNT(*)')) return [{ count: '3' }];
        if (sql.includes('FROM "organizations"') && sql.includes('COUNT(*)')) return [{ count: '2' }];
        if (sql.includes('FROM "users"') && sql.includes(`role <> 'superadmin'`)) return [{ count: '4' }];
        if (sql.includes('FROM "users"') && sql.includes(`role = 'superadmin' AND orgId IS NOT NULL`)) return [{ count: '1' }];
        if (sql.includes('SELECT id, email, name FROM "users" WHERE role = ')) {
          return [{ id: 'super-1', email: 'super@example.com', name: 'Super Admin' }];
        }
        if (sql.includes('COUNT(*)')) return [{ count: '0' }];
        return [];
      }),
    };

    const dataSource = {
      entityMetadatas: [
        { tableName: 'users', tablePath: 'users', relations: [] },
        { tableName: 'organizations', tablePath: 'organizations', relations: [] },
        { tableName: 'activities', tablePath: 'activities', relations: [] },
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
    return { service, queryRunner, queryLog, authService, auditService };
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

    expect(Object.keys(zip.files)).toContain('readable/stato-system-data-readable.xlsx');
    expect(Object.keys(zip.files)).toContain('manifest.json');
    expect(auditService.log).toHaveBeenCalled();
  });
});