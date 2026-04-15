import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import JSZip from 'jszip';
import { mkdir, readdir, readFile, rm, stat } from 'fs/promises';
import { join, relative } from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../common/audit.service';
import { AuditAction } from '../common/enums';
import { buildReadableWorkbook } from './system-data-workbook';

export type SystemDataActor = {
  id: string;
  role: string;
  orgId?: string | null;
  name?: string | null;
};

type ManagedTable = {
  key: string;
  path: string;
  filename: string;
};

type UploadFileEntry = {
  absolutePath: string;
  relativePath: string;
  size: number;
};

const PURGE_CONFIRMATION_TEXT = 'ALLE DATEN LOESCHEN';

@Injectable()
export class SystemDataService {
  private readonly logger = new Logger(SystemDataService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  async getSummary() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const managedTables = this.getManagedTables();
      const tableSummaries = [] as Array<{ tableName: string; rowCount: number }>;
      let totalDatabaseRows = 0;

      for (const table of managedTables) {
        const rowCount = await this.countRows(queryRunner, table.path);
        totalDatabaseRows += rowCount;
        tableSummaries.push({ tableName: table.filename, rowCount });
      }

      const uploads = await this.scanUploads();
      const superadmins = await queryRunner.query(
        `SELECT id, email, name FROM ${this.escapeTablePath('users')} WHERE role = 'superadmin' ORDER BY email ASC`,
      ) as Array<{ id: string; email: string; name: string | null }>;

      return {
        generatedAt: new Date().toISOString(),
        confirmationText: PURGE_CONFIRMATION_TEXT,
        totals: {
          managedTables: managedTables.length,
          databaseRows: totalDatabaseRows,
          uploadFiles: uploads.fileCount,
          uploadBytes: uploads.totalBytes,
        },
        superadmins,
        tables: tableSummaries,
      };
    } finally {
      await queryRunner.release();
    }
  }

  async exportAllData(actor: SystemDataActor) {
    this.assertSuperadmin(actor);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const managedTables = this.getManagedTables();
      const zip = new JSZip();
      const tableManifest: Array<{ tableName: string; rowCount: number; files: string[] }> = [];
      const tableRowsByKey: Record<string, Array<Record<string, unknown>>> = {};
      let totalDatabaseRows = 0;
      const generatedAt = new Date().toISOString();

      for (const table of managedTables) {
        const rows = await queryRunner.query(`SELECT * FROM ${this.escapeTablePath(table.path)}`) as Array<Record<string, unknown>>;
        tableRowsByKey[table.key] = rows;
        totalDatabaseRows += rows.length;

        const jsonPath = `database/${table.filename}.json`;
        const csvPath = `database/${table.filename}.csv`;
        zip.file(jsonPath, JSON.stringify(rows, null, 2));
        zip.file(csvPath, this.buildCsv(rows));

        tableManifest.push({
          tableName: table.filename,
          rowCount: rows.length,
          files: [jsonPath, csvPath],
        });
      }

      const uploads = await this.scanUploads();
      for (const file of uploads.files) {
        try {
          const buffer = await readFile(file.absolutePath);
          zip.file(`uploads/${file.relativePath}`, buffer);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown upload read error';
          uploads.warnings.push(`${file.relativePath}: ${message}`);
          this.logger.warn(`Could not add upload file ${file.absolutePath} to system export: ${message}`);
        }
      }

      const readableWorkbookPath = 'readable/stato-system-data-readable.xlsx';
      const readableWorkbook = buildReadableWorkbook({
        generatedAt,
        actor: {
          id: actor.id,
          name: actor.name ?? null,
          role: actor.role,
        },
        tableRows: tableRowsByKey,
        tableCounts: tableManifest.map((table) => ({ tableName: table.tableName, rowCount: table.rowCount })),
        uploads: {
          fileCount: uploads.fileCount,
          totalBytes: uploads.totalBytes,
          files: uploads.files.map((file) => ({ path: file.relativePath, size: file.size })),
          warnings: uploads.warnings,
        },
      });
      zip.file(readableWorkbookPath, readableWorkbook.buffer);

      const manifest = {
        generatedAt,
        generatedBy: {
          id: actor.id,
          name: actor.name ?? null,
          role: actor.role,
        },
        totals: {
          managedTables: managedTables.length,
          databaseRows: totalDatabaseRows,
          uploadFiles: uploads.fileCount,
          uploadBytes: uploads.totalBytes,
        },
        tables: tableManifest,
        uploads: {
          files: uploads.files.map((file) => ({ path: file.relativePath, size: file.size })),
          warnings: uploads.warnings,
        },
        readableWorkbook: {
          path: readableWorkbookPath,
          sheets: readableWorkbook.sheetNames,
        },
      };

      zip.file('manifest.json', JSON.stringify(manifest, null, 2));

      const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `stato-system-data-export-${timestamp}.zip`;

      try {
        await this.auditService.log({
          action: AuditAction.EXPORT,
          entityType: 'system-data',
          entityId: 'global',
          entityTitle: filename,
          user: { id: actor.id, name: actor.name ?? null, orgId: null },
          orgId: null,
          details: {
            managedTables: managedTables.length,
            databaseRows: totalDatabaseRows,
            uploadFiles: uploads.fileCount,
            uploadBytes: uploads.totalBytes,
          },
        });
      } catch {
        /* ignore audit errors */
      }

      return { buffer, filename };
    } finally {
      await queryRunner.release();
    }
  }

  async purgeAllData(
    actor: SystemDataActor,
    payload: { password: string; confirmationText: string },
  ) {
    this.assertSuperadmin(actor);
    await this.assertPassword(actor.id, payload.password);
    this.assertConfirmationText(payload.confirmationText);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    let result: {
      deletedTables: Array<{ tableName: string; deletedRows: number }>;
      deletedUsers: number;
      preservedSuperadmins: Array<{ id: string; email: string; name: string | null }>;
      clearedSuperadminOrgLinks: number;
      deletedUploadFiles: number;
      deletedUploadBytes: number;
      warnings: string[];
    } | null = null;

    try {
      await queryRunner.startTransaction();

      const deleteOrder = await this.getDeleteOrder(queryRunner, new Set(['users']));
      const deletedTables: Array<{ tableName: string; deletedRows: number }> = [];

      for (const table of deleteOrder) {
        const deletedRows = await this.countRows(queryRunner, table.path);
        if (deletedRows > 0) {
          await queryRunner.query(`DELETE FROM ${this.escapeTablePath(table.path)}`);
        }
        deletedTables.push({ tableName: table.filename, deletedRows });
      }

      const preservedSuperadmins = await queryRunner.query(
        `SELECT id, email, name FROM ${this.escapeTablePath('users')} WHERE role = 'superadmin' ORDER BY email ASC`,
      ) as Array<{ id: string; email: string; name: string | null }>;

      if (preservedSuperadmins.length === 0) {
        throw new InternalServerErrorException('Es muss mindestens ein Superadmin erhalten bleiben.');
      }

      const deletedUsers = await this.countRowsWhere(
        queryRunner,
        'users',
        `role <> 'superadmin'`,
      );
      if (deletedUsers > 0) {
        await queryRunner.query(`DELETE FROM ${this.escapeTablePath('users')} WHERE role <> 'superadmin'`);
      }

      const clearedSuperadminOrgLinks = await this.countRowsWhere(
        queryRunner,
        'users',
        `role = 'superadmin' AND "orgId" IS NOT NULL`,
      );
      if (clearedSuperadminOrgLinks > 0) {
        await queryRunner.query(
          `UPDATE ${this.escapeTablePath('users')} SET "orgId" = NULL WHERE role = 'superadmin' AND "orgId" IS NOT NULL`,
        );
      }

      await queryRunner.commitTransaction();

      const uploadsDeleted = await this.clearUploads();

      result = {
        deletedTables,
        deletedUsers,
        preservedSuperadmins,
        clearedSuperadminOrgLinks,
        deletedUploadFiles: uploadsDeleted.deletedFiles,
        deletedUploadBytes: uploadsDeleted.deletedBytes,
        warnings: uploadsDeleted.warnings,
      };
    } catch (error) {
      try {
        await queryRunner.rollbackTransaction();
      } catch {
        /* ignore rollback errors */
      }
      throw error;
    } finally {
      await queryRunner.release();
    }

    try {
      await this.auditService.log({
        action: AuditAction.PURGE,
        entityType: 'system-data',
        entityId: 'global',
        entityTitle: 'Full purge',
        user: { id: actor.id, name: actor.name ?? null, orgId: null },
        orgId: null,
        details: {
          deletedTables: result.deletedTables,
          deletedUsers: result.deletedUsers,
          preservedSuperadmins: result.preservedSuperadmins.map((user) => user.email),
          clearedSuperadminOrgLinks: result.clearedSuperadminOrgLinks,
          deletedUploadFiles: result.deletedUploadFiles,
          deletedUploadBytes: result.deletedUploadBytes,
          warnings: result.warnings,
        },
      });
    } catch {
      /* ignore audit errors */
    }

    return result;
  }

  private assertSuperadmin(actor: SystemDataActor) {
    if (actor.role !== 'superadmin') {
      throw new ForbiddenException('Nur Superadmin darf diese Aktion ausführen.');
    }
  }

  private async assertPassword(userId: string, password: string) {
    if (!String(password || '').trim()) {
      throw new BadRequestException('Passwort ist erforderlich.');
    }
    const valid = await this.authService.verifyPasswordForUser(userId, password);
    if (!valid) {
      throw new ForbiddenException('Passwort ist falsch.');
    }
  }

  private assertConfirmationText(value: string) {
    if (String(value || '').trim().toUpperCase() !== PURGE_CONFIRMATION_TEXT) {
      throw new BadRequestException(`Bitte exakt "${PURGE_CONFIRMATION_TEXT}" eingeben.`);
    }
  }

  private getManagedTables(): ManagedTable[] {
    const map = new Map<string, ManagedTable>();

    for (const metadata of this.dataSource.entityMetadatas) {
      this.registerManagedTable(map, metadata.tablePath || metadata.tableName);
      for (const relation of metadata.relations) {
        if (relation.junctionEntityMetadata) {
          this.registerManagedTable(
            map,
            relation.junctionEntityMetadata.tablePath || relation.junctionEntityMetadata.tableName,
          );
        }
      }
    }

    return Array.from(map.values()).sort((left, right) => left.filename.localeCompare(right.filename));
  }

  private registerManagedTable(target: Map<string, ManagedTable>, tablePath: string) {
    const key = this.normalizeTableKey(tablePath);
    if (!key || target.has(key)) return;
    target.set(key, { key, path: tablePath, filename: key });
  }

  private normalizeTableKey(tablePath: string) {
    return String(tablePath || '')
      .replace(/"/g, '')
      .split('.')
      .filter(Boolean)
      .pop()
      ?.toLowerCase() || '';
  }

  private escapeTablePath(tablePath: string) {
    return String(tablePath || '')
      .replace(/"/g, '')
      .split('.')
      .filter(Boolean)
      .map((segment) => `"${segment.replace(/"/g, '""')}"`)
      .join('.');
  }

  private async countRows(queryRunner: QueryRunner, tablePath: string) {
    const rows = await queryRunner.query(`SELECT COUNT(*) AS count FROM ${this.escapeTablePath(tablePath)}`) as Array<{ count?: string | number }>;
    return Number(rows?.[0]?.count || 0);
  }

  private async countRowsWhere(queryRunner: QueryRunner, tablePath: string, whereSql: string) {
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM ${this.escapeTablePath(tablePath)} WHERE ${whereSql}`,
    ) as Array<{ count?: string | number }>;
    return Number(rows?.[0]?.count || 0);
  }

  private async getDeleteOrder(queryRunner: QueryRunner, excludedKeys: Set<string>) {
    const managedTables = this.getManagedTables();
    const tableByKey = new Map(managedTables.map((table) => [table.key, table]));
    const tableMetadata = await queryRunner.getTables(managedTables.map((table) => table.path));
    const dependencies = new Map<string, Set<string>>();

    for (const table of managedTables) {
      if (excludedKeys.has(table.key)) continue;
      dependencies.set(table.key, new Set());
    }

    for (const table of tableMetadata) {
      const key = this.normalizeTableKey(table.name);
      if (!key || excludedKeys.has(key) || !dependencies.has(key)) continue;

      const tableDeps = dependencies.get(key) || new Set<string>();
      for (const foreignKey of table.foreignKeys) {
        const referencedKey = this.normalizeTableKey(foreignKey.referencedTableName || '');
        if (
          !referencedKey ||
          referencedKey === key ||
          excludedKeys.has(referencedKey) ||
          !tableByKey.has(referencedKey)
        ) {
          continue;
        }
        tableDeps.add(referencedKey);
      }
      dependencies.set(key, tableDeps);
    }

    const order: string[] = [];
    const pending = new Map<string, Set<string>>(
      Array.from(dependencies.entries()).map(([key, deps]) => [key, new Set(deps)]),
    );

    while (pending.size > 0) {
      const ready = Array.from(pending.entries())
        .filter(([, deps]) => deps.size === 0)
        .map(([key]) => key)
        .sort((left, right) => left.localeCompare(right));

      if (ready.length === 0) {
        const fallback = Array.from(pending.keys()).sort((left, right) => left.localeCompare(right));
        order.push(...fallback);
        break;
      }

      for (const key of ready) {
        order.push(key);
        pending.delete(key);
        for (const deps of pending.values()) {
          deps.delete(key);
        }
      }
    }

    return order
      .reverse()
      .map((key) => tableByKey.get(key))
      .filter((table): table is ManagedTable => Boolean(table));
  }

  private serializeCsvValue(value: unknown) {
    if (value === null || typeof value === 'undefined') return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private escapeCsvValue(value: string) {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private buildCsv(rows: Array<Record<string, unknown>>) {
    if (!rows.length) return '';
    const columns = Array.from(
      rows.reduce((set, row) => {
        Object.keys(row || {}).forEach((key) => set.add(key));
        return set;
      }, new Set<string>()),
    );
    const header = columns.map((column) => this.escapeCsvValue(column)).join(',');
    const body = rows.map((row) =>
      columns
        .map((column) => this.escapeCsvValue(this.serializeCsvValue(row[column])))
        .join(','),
    );
    return [header, ...body].join('\n');
  }

  private async scanUploads(): Promise<{
    files: UploadFileEntry[];
    fileCount: number;
    totalBytes: number;
    warnings: string[];
  }> {
    const uploadsRoot = join(process.cwd(), 'uploads');
    const warnings: string[] = [];
    const files: UploadFileEntry[] = [];

    const walk = async (dir: string) => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown directory read error';
        warnings.push(`${relative(uploadsRoot, dir) || '.'}: ${message}`);
        return;
      }

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
          continue;
        }
        if (!entry.isFile()) continue;
        try {
          const info = await stat(fullPath);
          files.push({
            absolutePath: fullPath,
            relativePath: relative(uploadsRoot, fullPath).replace(/\\/g, '/'),
            size: info.size,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown file stat error';
          warnings.push(`${relative(uploadsRoot, fullPath).replace(/\\/g, '/')}: ${message}`);
        }
      }
    };

    try {
      await stat(uploadsRoot);
      await walk(uploadsRoot);
    } catch {
      return { files: [], fileCount: 0, totalBytes: 0, warnings: [] };
    }

    return {
      files,
      fileCount: files.length,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      warnings,
    };
  }

  private async clearUploads() {
    const uploadsRoot = join(process.cwd(), 'uploads');
    const scan = await this.scanUploads();
    const warnings = [...scan.warnings];

    try {
      await rm(uploadsRoot, { recursive: true, force: true });
      await mkdir(join(uploadsRoot, 'images'), { recursive: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown upload cleanup error';
      warnings.push(message);
      this.logger.warn(`Upload cleanup completed with warning: ${message}`);
    }

    return {
      deletedFiles: scan.fileCount,
      deletedBytes: scan.totalBytes,
      warnings,
    };
  }
}