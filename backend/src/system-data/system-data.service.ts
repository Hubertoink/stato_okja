import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createReadStream } from 'fs';
import { stat, unlink } from 'fs/promises';
import { join, relative, resolve as resolvePath, sep } from 'path';
import { PassThrough, Readable } from 'stream';
import { setTimeout as delay } from 'timers/promises';
import { DataSource, QueryRunner } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../common/audit.service';
import { AuditAction } from '../common/enums';
import { normalizeUploadPath } from '../common/upload-paths';
import {
  SystemDataUploadStore,
  type AppliedImportUploads,
  type StagedImportUploads,
  type UploadFileEntry,
} from './system-data-upload-store';
import {
  SystemDataImportArchiveReader,
  type ImportedTableData,
  type ParsedImportArchive,
  type SystemDataManagedTable,
  type SystemDataManifest,
} from './system-data-import-archive-reader';

type ExportArchive = import('archiver').Archiver;
type ExportArchiveEntry = import('archiver').EntryData;
type ArchiverModule = {
  ZipArchive: new (options: { zlib: { level: number } }) => ExportArchive;
};

let archiverModulePromise: Promise<ArchiverModule> | undefined;

function loadArchiverModule() {
  // Archiver v8 is ESM-only while StatO's Nest build remains CommonJS. Keep
  // the native dynamic import intact instead of transpiling it to require().
  archiverModulePromise ??= new Function('specifier', 'return import(specifier)')(
    'archiver',
  ) as Promise<ArchiverModule>;
  return archiverModulePromise;
}

export type SystemDataActor = {
  id: string;
  role: string;
  orgId?: string | null;
  name?: string | null;
};

type ManagedTable = SystemDataManagedTable;

type UploadReferenceBreakdown = {
  projects: number;
  projectDocuments: number;
  projectTemplates: number;
  userAvatars: number;
};

type UploadReferenceKey = keyof UploadReferenceBreakdown;

type UploadReferenceDetails = {
  projects: Array<{ id: string; title: string; orgId: string | null }>;
  projectDocuments: Array<{ id: string; filename: string; projectId: string; projectTitle: string | null; orgId: string | null }>;
  projectTemplates: Array<{ id: string; title: string; orgId: string | null }>;
  userAvatars: Array<{ id: string; name: string | null; email: string; role: string; orgId: string | null }>;
};

type UploadReferenceSummary = {
  breakdown: UploadReferenceBreakdown;
  details: UploadReferenceDetails;
};

const PURGE_CONFIRMATION_TEXT = 'ALLE DATEN LOESCHEN';
const IMPORT_CONFIRMATION_TEXT = 'BACKUP IMPORTIEREN';
const SYSTEM_DATA_EXPORT_FORMAT = 'stato-system-data-export';
const SYSTEM_DATA_EXPORT_SCHEMA_VERSION = 2;
const EMPTY_UPLOAD_REFERENCE_BREAKDOWN: UploadReferenceBreakdown = {
  projects: 0,
  projectDocuments: 0,
  projectTemplates: 0,
  userAvatars: 0,
};

@Injectable()
export class SystemDataService {
  private readonly logger = new Logger(SystemDataService.name);
  private readonly uploadStore = new SystemDataUploadStore();
  private readonly importArchiveReader = new SystemDataImportArchiveReader();

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

      const uploads = await this.uploadStore.scanUploads();
      const superadmins = await queryRunner.query(
        `SELECT id, email, name FROM ${this.escapeTablePath('users')} WHERE role = 'superadmin' ORDER BY email ASC`,
      ) as Array<{ id: string; email: string; name: string | null }>;

      return {
        generatedAt: new Date().toISOString(),
        confirmationText: PURGE_CONFIRMATION_TEXT,
        restoreConfirmationText: IMPORT_CONFIRMATION_TEXT,
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

  async listUploads(actor: SystemDataActor) {
    this.assertSuperadmin(actor);

    const uploads = await this.uploadStore.scanUploads();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const references = await this.buildUploadReferenceIndex(queryRunner);
      const items = uploads.files
        .map((file) => {
          const url = this.getUploadUrl(file.relativePath);
          const referenceSummary = references.get(url) ?? this.createEmptyUploadReferenceSummary();
          const referenceBreakdown = referenceSummary.breakdown;
          const referenceCount = this.getUploadReferenceCount(referenceBreakdown);
          return {
            relativePath: file.relativePath,
            filename: file.relativePath.split('/').pop() || file.relativePath,
            size: file.size,
            url,
            isImage: this.isImagePath(file.relativePath),
            referenceCount,
            referenceBreakdown,
            referenceDetails: referenceSummary.details,
          };
        })
        .sort((left, right) => {
          if (right.referenceCount !== left.referenceCount) return right.referenceCount - left.referenceCount;
          if (right.size !== left.size) return right.size - left.size;
          return left.relativePath.localeCompare(right.relativePath);
        });

      return {
        generatedAt: new Date().toISOString(),
        uploads: items,
      };
    } finally {
      await queryRunner.release();
    }
  }

  async deleteUpload(actor: SystemDataActor, inputRelativePath: string) {
    this.assertSuperadmin(actor);

    const { relativePath, absolutePath } = this.resolveUploadPath(inputRelativePath);
    let fileInfo;
    try {
      fileInfo = await stat(absolutePath);
    } catch {
      throw new NotFoundException('Upload-Datei wurde nicht gefunden.');
    }

    if (!fileInfo.isFile()) {
      throw new BadRequestException('Nur Dateien können gelöscht werden.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    let referenceBreakdown = { ...EMPTY_UPLOAD_REFERENCE_BREAKDOWN };
    try {
      await queryRunner.startTransaction();
      referenceBreakdown = await this.clearUploadReferences(queryRunner, relativePath);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    try {
      await this.unlinkUploadWithRetry(absolutePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown upload delete error';
      throw new InternalServerErrorException(`Upload-Datei konnte nicht gelöscht werden: ${message}`);
    }

    const clearedReferences = this.getUploadReferenceCount(referenceBreakdown);
    await this.auditService.log({
      action: AuditAction.DELETE,
      entityType: 'system-upload',
      entityId: relativePath,
      entityTitle: relativePath,
      orgId: null,
      user: actor,
      details: {
        size: fileInfo.size,
        clearedReferences,
        referenceBreakdown,
      },
    });

    return {
      relativePath,
      deleted: true,
      deletedBytes: fileInfo.size,
      clearedReferences,
      referenceBreakdown,
    };
  }

  async deleteUploads(actor: SystemDataActor, inputRelativePaths: string[]) {
    this.assertSuperadmin(actor);

    const uniquePaths = Array.from(new Set(
      (inputRelativePaths || [])
        .map((path) => String(path || '').trim())
        .filter(Boolean),
    ));
    if (!uniquePaths.length) {
      throw new BadRequestException('Mindestens eine Upload-Datei ist erforderlich.');
    }

    const deleted: Array<{
      relativePath: string;
      deletedBytes: number;
      clearedReferences: number;
      referenceBreakdown: UploadReferenceBreakdown;
    }> = [];
    const failures: Array<{ relativePath: string; message: string }> = [];

    for (const relativePath of uniquePaths) {
      try {
        const result = await this.deleteUpload(actor, relativePath);
        deleted.push({
          relativePath: result.relativePath,
          deletedBytes: result.deletedBytes,
          clearedReferences: result.clearedReferences,
          referenceBreakdown: result.referenceBreakdown,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unbekannter Löschfehler';
        failures.push({ relativePath, message });
      }
    }

    return {
      deleted,
      failures,
      deletedCount: deleted.length,
      deletedBytes: deleted.reduce((sum, item) => sum + item.deletedBytes, 0),
      clearedReferences: deleted.reduce((sum, item) => sum + item.clearedReferences, 0),
    };
  }

  async exportAllData(actor: SystemDataActor) {
    this.assertSuperadmin(actor);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const managedTables = this.getManagedTables();
      const tableManifest: Array<{ tableName: string; rowCount: number; files: string[] }> = [];
      let totalDatabaseRows = 0;
      const generatedAt = new Date().toISOString();

      for (const table of managedTables) {
        const rowCount = await this.countRows(queryRunner, table.path);
        totalDatabaseRows += rowCount;
        const jsonPath = `database/${table.filename}.json`;
        const csvPath = `database/${table.filename}.csv`;
        tableManifest.push({
          tableName: table.filename,
          rowCount,
          files: [jsonPath, csvPath],
        });
      }

      const uploads = await this.uploadStore.scanUploads();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `stato-system-data-export-${timestamp}.zip`;
      const output = new PassThrough();
      const { ZipArchive } = await loadArchiverModule();
      const archive = new ZipArchive({ zlib: { level: 6 } });
      archive.on('warning', (error) => this.logger.warn(`System export ZIP warning: ${error.message}`));
      archive.on('error', (error) => output.destroy(error));
      archive.pipe(output);

      void this.writeExportArchive({
        archive,
        output,
        queryRunner,
        managedTables,
        tableManifest,
        totalDatabaseRows,
        uploads,
        generatedAt,
        actor,
        filename,
      });

      return { stream: output, filename };
    } catch (error) {
      await queryRunner.release();
      throw error;
    }
  }

  async inspectImportArchive(actor: SystemDataActor, filePath: string, originalFilename: string) {
    this.assertSuperadmin(actor);

    try {
      const archive = await this.importArchiveReader.read({
        filePath,
        originalFilename,
        managedTables: this.getManagedTables(),
        exportFormat: SYSTEM_DATA_EXPORT_FORMAT,
        schemaVersion: SYSTEM_DATA_EXPORT_SCHEMA_VERSION,
        normalizeRowsForImport: (table, rows) => this.normalizeRowsForImport(table, rows),
      });
      return this.buildImportPreview(archive);
    } finally {
      await this.uploadStore.removePath(filePath);
    }
  }

  async importAllData(
    actor: SystemDataActor,
    filePath: string,
    payload: { originalFilename: string; password: string; confirmationText: string },
  ) {
    this.assertSuperadmin(actor);
    await this.assertPassword(actor.id, payload.password);
    this.assertImportConfirmationText(payload.confirmationText);

    let stagedUploads: StagedImportUploads | null = null;
    let appliedUploads: AppliedImportUploads | null = null;
    let archive: ParsedImportArchive | null = null;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      archive = await this.importArchiveReader.read({
        filePath,
        originalFilename: payload.originalFilename,
        managedTables: this.getManagedTables(),
        exportFormat: SYSTEM_DATA_EXPORT_FORMAT,
        schemaVersion: SYSTEM_DATA_EXPORT_SCHEMA_VERSION,
        normalizeRowsForImport: (table, rows) => this.normalizeRowsForImport(table, rows),
      });
      stagedUploads = await this.uploadStore.stageImportedUploads(archive.uploads);

      await queryRunner.startTransaction();

      const deleteOrder = await this.getDeleteOrder(queryRunner, new Set());
      const deletedTables: Array<{ tableName: string; deletedRows: number }> = [];
      for (const table of deleteOrder) {
        const deletedRows = await this.countRows(queryRunner, table.path);
        if (deletedRows > 0) {
          await queryRunner.query(`DELETE FROM ${this.escapeTablePath(table.path)}`);
        }
        deletedTables.push({ tableName: table.filename, deletedRows });
      }

      const importOrder = await this.getInsertOrder(queryRunner, new Set());
      const importedTableMap = new Map(archive.tables.map((table) => [table.key, table]));
      const importedTables: Array<{ tableName: string; importedRows: number }> = [];
      for (const table of importOrder) {
        const importedTable = importedTableMap.get(table.key);
        if (!importedTable) continue;
        await this.insertRows(queryRunner, table.path, importedTable.rows);
        importedTables.push({ tableName: table.filename, importedRows: importedTable.rows.length });
      }

      appliedUploads = await this.uploadStore.applyImportedUploads(stagedUploads);
      await queryRunner.commitTransaction();

      if (appliedUploads.backupRoot) {
        await this.uploadStore.removePath(appliedUploads.backupRoot);
      }
      await this.uploadStore.removePath(stagedUploads.sessionRoot);

      try {
        await this.auditService.log({
          action: AuditAction.UPDATE,
          entityType: 'system-data',
          entityId: 'global',
          entityTitle: `Import ${payload.originalFilename}`,
          user: { id: actor.id, name: actor.name ?? null, orgId: null },
          orgId: null,
          details: {
            filename: payload.originalFilename,
            importedTables,
            importedUploadFiles: stagedUploads.fileCount,
            importedUploadBytes: stagedUploads.totalBytes,
            warnings: archive.warnings,
          },
        });
      } catch {
        /* ignore audit errors */
      }

      return {
        importedAt: new Date().toISOString(),
        filename: payload.originalFilename,
        deletedTables,
        importedTables,
        importedUploadFiles: stagedUploads.fileCount,
        importedUploadBytes: stagedUploads.totalBytes,
        warnings: archive.warnings,
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        try {
          await queryRunner.rollbackTransaction();
        } catch {
          /* ignore rollback errors */
        }
      }

      if (appliedUploads) {
        await this.uploadStore.restorePreviousUploads(appliedUploads);
      }

      if (stagedUploads) {
        await this.uploadStore.removePath(stagedUploads.sessionRoot);
      }

      throw error;
    } finally {
      await queryRunner.release();
      await this.uploadStore.removePath(filePath);
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

      const uploadsDeleted = await this.uploadStore.clearUploads();

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

  private assertImportConfirmationText(value: string) {
    if (String(value || '').trim().toUpperCase() !== IMPORT_CONFIRMATION_TEXT) {
      throw new BadRequestException(`Bitte exakt "${IMPORT_CONFIRMATION_TEXT}" eingeben.`);
    }
  }

  private getManagedTables(): ManagedTable[] {
    const map = new Map<string, ManagedTable>();

    for (const metadata of this.dataSource.entityMetadatas) {
      this.registerManagedTable(map, metadata.tablePath || metadata.tableName, metadata.columns || []);
      for (const relation of metadata.relations) {
        if (relation.junctionEntityMetadata) {
          this.registerManagedTable(
            map,
            relation.junctionEntityMetadata.tablePath || relation.junctionEntityMetadata.tableName,
            relation.junctionEntityMetadata.columns || [],
          );
        }
      }
    }

    return Array.from(map.values()).sort((left, right) => left.filename.localeCompare(right.filename));
  }

  private registerManagedTable(
    target: Map<string, ManagedTable>,
    tablePath: string,
    columns: Array<{ databaseName?: string; type?: unknown }>,
  ) {
    const key = this.normalizeTableKey(tablePath);
    if (!key || target.has(key)) return;
    target.set(key, {
      key,
      path: tablePath,
      filename: key,
      columnTypes: this.buildColumnTypeMap(columns),
    });
  }

  private buildColumnTypeMap(columns: Array<{ databaseName?: string; type?: unknown }>) {
    const columnTypes: Record<string, string> = {};
    for (const column of columns) {
      const columnName = String(column?.databaseName || '').trim();
      if (!columnName) continue;
      columnTypes[columnName] = this.normalizeColumnType(column?.type);
    }
    return columnTypes;
  }

  private normalizeColumnType(columnType: unknown) {
    if (typeof columnType === 'string') return columnType.toLowerCase();
    if (typeof columnType === 'function') return String(columnType.name || '').toLowerCase();
    if (columnType && typeof columnType === 'object' && 'name' in (columnType as Record<string, unknown>)) {
      return String((columnType as { name?: string }).name || '').toLowerCase();
    }
    return String(columnType || '').toLowerCase();
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
    return (await this.getDependencyOrder(queryRunner, excludedKeys)).slice().reverse();
  }

  private async getInsertOrder(queryRunner: QueryRunner, excludedKeys: Set<string>) {
    return this.getDependencyOrder(queryRunner, excludedKeys);
  }

  private async getDependencyOrder(queryRunner: QueryRunner, excludedKeys: Set<string>) {
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
      .map((key) => tableByKey.get(key))
      .filter((table): table is ManagedTable => Boolean(table));
  }

  private buildImportPreview(archive: ParsedImportArchive) {
    const databaseRows = archive.tables.reduce((sum, table) => sum + table.rows.length, 0);
    const uploadBytes = archive.uploads.reduce((sum, file) => sum + file.size, 0);

    return {
      filename: archive.originalFilename,
      generatedAt: archive.manifest.generatedAt || null,
      generatedBy: archive.manifest.generatedBy || null,
      format: archive.manifest.format || 'legacy',
      schemaVersion: archive.manifest.schemaVersion || null,
      confirmationText: IMPORT_CONFIRMATION_TEXT,
      totals: {
        managedTables: archive.tables.length,
        databaseRows,
        uploadFiles: archive.uploads.length,
        uploadBytes,
      },
      tables: archive.tables
        .map((table) => ({ tableName: table.filename, rowCount: table.rows.length }))
        .sort((left, right) => right.rowCount - left.rowCount),
      warnings: archive.warnings,
    };
  }

  private async buildUploadReferenceIndex(queryRunner: QueryRunner) {
    const references = new Map<string, UploadReferenceSummary>();

    const addReference = (
      rawPath: unknown,
      key: UploadReferenceKey,
      detail: UploadReferenceDetails[UploadReferenceKey][number],
    ) => {
      const normalizedPath = normalizeUploadPath(typeof rawPath === 'string' ? rawPath : null);
      if (!normalizedPath || !normalizedPath.startsWith('/uploads/')) return;
      const current = references.get(normalizedPath) ?? this.createEmptyUploadReferenceSummary();
      current.breakdown[key] += 1;
      current.details[key].push(detail as never);
      references.set(normalizedPath, current);
    };

    const projectRows = await queryRunner.query(
      `SELECT "id", "title", "orgId", "imageUrl" FROM ${this.escapeTablePath('projects')} WHERE "imageUrl" IS NOT NULL AND "imageUrl" != ''`,
    ) as Array<{ id: string; title: string; orgId: string | null; imageUrl?: string | null }>;
    projectRows.forEach((row) => addReference(row.imageUrl, 'projects', {
      id: row.id,
      title: row.title,
      orgId: row.orgId ?? null,
    }));

    const projectDocumentRows = await queryRunner.query(
      `SELECT pd."id", pd."filename", pd."projectId", pd."storageRef", p."title" AS "projectTitle", p."orgId" FROM ${this.escapeTablePath('project_documents')} pd LEFT JOIN ${this.escapeTablePath('projects')} p ON p."id" = pd."projectId" WHERE pd."storageRef" IS NOT NULL AND pd."storageRef" != ''`,
    ) as Array<{ id: string; filename: string; projectId: string; storageRef?: string | null; projectTitle?: string | null; orgId: string | null }>;
    projectDocumentRows.forEach((row) => addReference(this.getUploadUrl(String(row.storageRef || '')), 'projectDocuments', {
      id: row.id,
      filename: row.filename,
      projectId: row.projectId,
      projectTitle: row.projectTitle ?? null,
      orgId: row.orgId ?? null,
    }));

    const templateRows = await queryRunner.query(
      `SELECT "id", "title", "orgId", "imageUrl" FROM ${this.escapeTablePath('project_templates')} WHERE "imageUrl" IS NOT NULL AND "imageUrl" != ''`,
    ) as Array<{ id: string; title: string; orgId: string | null; imageUrl?: string | null }>;
    templateRows.forEach((row) => addReference(row.imageUrl, 'projectTemplates', {
      id: row.id,
      title: row.title,
      orgId: row.orgId ?? null,
    }));

    const userRows = await queryRunner.query(
      `SELECT "id", "name", "email", "role", "orgId", "avatarUrl" FROM ${this.escapeTablePath('users')} WHERE "avatarUrl" IS NOT NULL AND "avatarUrl" != ''`,
    ) as Array<{ id: string; name: string | null; email: string; role: string; orgId: string | null; avatarUrl?: string | null }>;
    userRows.forEach((row) => addReference(row.avatarUrl, 'userAvatars', {
      id: row.id,
      name: row.name ?? null,
      email: row.email,
      role: row.role,
      orgId: row.orgId ?? null,
    }));

    return references;
  }

  private async clearUploadReferences(queryRunner: QueryRunner, relativePath: string) {
    const candidates = this.buildUploadPathCandidates(relativePath);
    const referenceBreakdown = {
      projects: await this.countUploadFieldMatches(queryRunner, 'projects', 'imageUrl', candidates),
      projectDocuments: await this.countUploadFieldMatches(queryRunner, 'project_documents', 'storageRef', candidates),
      projectTemplates: await this.countUploadFieldMatches(queryRunner, 'project_templates', 'imageUrl', candidates),
      userAvatars: await this.countUploadFieldMatches(queryRunner, 'users', 'avatarUrl', candidates),
    } satisfies UploadReferenceBreakdown;

    await this.clearUploadField(queryRunner, 'projects', { imageUrl: null, imageSize: null }, 'imageUrl', candidates);
    await this.deleteUploadRows(queryRunner, 'project_documents', 'storageRef', candidates);
    await this.clearUploadField(queryRunner, 'project_templates', { imageUrl: null }, 'imageUrl', candidates);
    await this.clearUploadField(queryRunner, 'users', { avatarUrl: null }, 'avatarUrl', candidates);

    return referenceBreakdown;
  }

  private async countUploadFieldMatches(
    queryRunner: QueryRunner,
    tablePath: string,
    field: string,
    candidates: string[],
  ) {
    if (!candidates.length) return 0;
    const placeholders = candidates.map((_value, index) => this.getParameterPlaceholder(index + 1)).join(', ');
    const rows = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM ${this.escapeTablePath(tablePath)} WHERE ${this.escapeIdentifier(field)} IN (${placeholders})`,
      candidates,
    ) as Array<{ count?: string | number }>;
    return Number(rows[0]?.count || 0) || 0;
  }

  private async clearUploadField(
    queryRunner: QueryRunner,
    tablePath: string,
    values: Record<string, unknown>,
    field: string,
    candidates: string[],
  ) {
    if (!candidates.length) return;

    const params: unknown[] = [];
    const setSql = Object.entries(values)
      .map(([column, value]) => {
        params.push(value);
        return `${this.escapeIdentifier(column)} = ${this.getParameterPlaceholder(params.length)}`;
      })
      .join(', ');

    const whereSql = candidates
      .map((candidate) => {
        params.push(candidate);
        return this.getParameterPlaceholder(params.length);
      })
      .join(', ');

    await queryRunner.query(
      `UPDATE ${this.escapeTablePath(tablePath)} SET ${setSql} WHERE ${this.escapeIdentifier(field)} IN (${whereSql})`,
      params,
    );
  }

  private async deleteUploadRows(
    queryRunner: QueryRunner,
    tablePath: string,
    field: string,
    candidates: string[],
  ) {
    if (!candidates.length) return;

    const placeholders = candidates.map((_candidate, index) => this.getParameterPlaceholder(index + 1)).join(', ');
    await queryRunner.query(
      `DELETE FROM ${this.escapeTablePath(tablePath)} WHERE ${this.escapeIdentifier(field)} IN (${placeholders})`,
      candidates,
    );
  }

  private async insertRows(queryRunner: QueryRunner, tablePath: string, rows: Array<Record<string, unknown>>) {
    if (!rows.length) return;

    const columns = Array.from(
      rows.reduce((set, row) => {
        Object.keys(row || {}).forEach((key) => set.add(key));
        return set;
      }, new Set<string>()),
    );
    if (!columns.length) return;

    const chunkSize = 100;
    for (let offset = 0; offset < rows.length; offset += chunkSize) {
      const chunk = rows.slice(offset, offset + chunkSize);
      const params: unknown[] = [];
      const valuesSql = chunk
        .map((row) => `(${columns.map((column) => {
          params.push(Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null);
          return this.getParameterPlaceholder(params.length);
        }).join(', ')})`)
        .join(', ');

      await queryRunner.query(
        `INSERT INTO ${this.escapeTablePath(tablePath)} (${columns.map((column) => this.escapeIdentifier(column)).join(', ')}) VALUES ${valuesSql}`,
        params,
      );
    }
  }

  private escapeIdentifier(value: string) {
    return `"${String(value || '').replace(/"/g, '""')}"`;
  }

  private getParameterPlaceholder(index: number) {
    const dataSourceType = (this.dataSource as { options?: { type?: string } }).options?.type;
    return dataSourceType === 'postgres' ? `$${index}` : '?';
  }

  private getUploadReferenceCount(referenceBreakdown: UploadReferenceBreakdown) {
    return Object.values(referenceBreakdown).reduce((sum, count) => sum + count, 0);
  }

  private createEmptyUploadReferenceSummary(): UploadReferenceSummary {
    return {
      breakdown: { ...EMPTY_UPLOAD_REFERENCE_BREAKDOWN },
      details: {
        projects: [],
        projectDocuments: [],
        projectTemplates: [],
        userAvatars: [],
      },
    };
  }

  private getUploadUrl(relativePath: string) {
    return `/uploads/${String(relativePath || '').replace(/^\/+/, '').replace(/\\/g, '/')}`;
  }

  private isImagePath(relativePath: string) {
    return /\.(png|jpe?g|webp|gif)$/i.test(relativePath);
  }

  private resolveUploadPath(inputRelativePath: string) {
    const raw = String(inputRelativePath || '').trim();
    if (!raw) throw new BadRequestException('Upload-Pfad ist erforderlich.');

    const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^uploads\//, '');
    const uploadsRoot = resolvePath(join(process.cwd(), 'uploads'));
    const absolutePath = resolvePath(uploadsRoot, normalized);

    if (!absolutePath.startsWith(`${uploadsRoot}${sep}`)) {
      throw new BadRequestException('Ungültiger Upload-Pfad.');
    }

    return {
      relativePath: relative(uploadsRoot, absolutePath).replace(/\\/g, '/'),
      absolutePath,
    };
  }

  private buildUploadPathCandidates(relativePath: string) {
    const normalized = relativePath.replace(/^\/+/, '').replace(/\\/g, '/');
    const publicPath = this.getUploadUrl(normalized);
    const candidates = new Set<string>([normalized, publicPath, publicPath.slice(1)]);
    if (normalized.startsWith('images/')) {
      const filename = normalized.slice('images/'.length);
      if (filename) candidates.add(filename);
    }
    return Array.from(candidates);
  }

  private async unlinkUploadWithRetry(absolutePath: string) {
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await unlink(absolutePath);
        return;
      } catch (error) {
        if (!this.isTransientUploadDeleteError(error) || attempt === maxAttempts) {
          throw error;
        }
        await delay(75 * attempt);
      }
    }
  }

  private isTransientUploadDeleteError(error: unknown) {
    const code = typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: string }).code || '')
      : '';
    return code === 'EPERM' || code === 'EBUSY' || code === 'EMFILE' || code === 'ENFILE';
  }

  private async writeExportArchive(input: {
    archive: ExportArchive;
    output: PassThrough;
    queryRunner: QueryRunner;
    managedTables: ManagedTable[];
    tableManifest: Array<{ tableName: string; rowCount: number; files: string[] }>;
    totalDatabaseRows: number;
    uploads: { files: UploadFileEntry[]; fileCount: number; totalBytes: number; warnings: string[] };
    generatedAt: string;
    actor: SystemDataActor;
    filename: string;
  }) {
    const {
      archive,
      output,
      queryRunner,
      managedTables,
      tableManifest,
      totalDatabaseRows,
      uploads,
      generatedAt,
      actor,
      filename,
    } = input;

    try {
      for (const table of managedTables) {
        await this.appendExportStream(archive, this.createJsonExportStream(queryRunner, table), `database/${table.filename}.json`);
        await this.appendExportStream(archive, this.createCsvExportStream(queryRunner, table), `database/${table.filename}.csv`);
      }

      for (const file of uploads.files) {
        await this.appendExportStream(archive, this.createUploadExportStream(file, uploads.warnings), `uploads/${file.relativePath}`);
      }

      await this.appendExportStream(archive, this.createManifestExportStream(() => JSON.stringify({
        format: SYSTEM_DATA_EXPORT_FORMAT,
        schemaVersion: SYSTEM_DATA_EXPORT_SCHEMA_VERSION,
        generatedAt,
        generatedBy: { id: actor.id, name: actor.name ?? null, role: actor.role },
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
      }, null, 2)), 'manifest.json');

      await archive.finalize();

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown export error';
      this.logger.error(`System export failed: ${message}`);
      archive.destroy(error instanceof Error ? error : new Error(message));
      output.destroy(error instanceof Error ? error : new Error(message));
    } finally {
      await queryRunner.release();
    }
  }

  private createJsonExportStream(queryRunner: QueryRunner, table: ManagedTable) {
    return Readable.from(this.iterateJsonExportRows(queryRunner, table));
  }

  private appendExportStream(archive: ExportArchive, stream: Readable, name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        archive.off('entry', onEntry);
        archive.off('error', onArchiveError);
        stream.off('error', onStreamError);
        callback();
      };
      const onEntry = (entry: ExportArchiveEntry) => {
        if (entry.name === name) finish(resolve);
      };
      const onStreamError = (error: Error) => {
        archive.destroy(error);
        finish(() => reject(error));
      };
      const onArchiveError = (error: Error) => finish(() => reject(error));

      archive.once('entry', onEntry);
      archive.once('error', onArchiveError);
      stream.once('error', onStreamError);
      archive.append(stream, { name });
    });
  }

  private async *iterateJsonExportRows(queryRunner: QueryRunner, table: ManagedTable): AsyncGenerator<string> {
    yield '[\n';
    let first = true;
    for await (const row of this.iterateExportRows(queryRunner, table)) {
      yield `${first ? '' : ',\n'}${JSON.stringify(row)}`;
      first = false;
    }
    yield '\n]\n';
  }

  private createCsvExportStream(queryRunner: QueryRunner, table: ManagedTable) {
    return Readable.from(this.iterateCsvExportRows(queryRunner, table));
  }

  private async *iterateCsvExportRows(queryRunner: QueryRunner, table: ManagedTable): AsyncGenerator<string> {
    let columns: string[] | null = null;
    for await (const row of this.iterateExportRows(queryRunner, table)) {
      if (!columns) {
        columns = Object.keys(row);
        yield `${columns.map((column) => this.escapeCsvValue(column)).join(',')}\n`;
      }
      yield `${columns.map((column) => this.escapeCsvValue(this.serializeCsvValue(row[column]))).join(',')}\n`;
    }
  }

  private async *iterateExportRows(queryRunner: QueryRunner, table: ManagedTable): AsyncGenerator<Record<string, unknown>> {
    const sql = `SELECT * FROM ${this.escapeTablePath(table.path)}`;
    if (this.dataSource.options.type === 'postgres') {
      const rowStream = await queryRunner.stream(sql);
      for await (const row of rowStream as AsyncIterable<Record<string, unknown>>) {
        yield this.normalizeDateOnlyColumns(table, row);
      }
      return;
    }

    const chunkSize = 1_000;
    for (let offset = 0; ; offset += chunkSize) {
      const rows = await queryRunner.query(`${sql} LIMIT ${chunkSize} OFFSET ${offset}`) as Array<Record<string, unknown>>;
      if (!rows.length) return;
      for (const row of rows) yield this.normalizeDateOnlyColumns(table, row);
      if (rows.length < chunkSize) return;
    }
  }

  private createUploadExportStream(file: UploadFileEntry, warnings: string[]) {
    const logger = this.logger;
    return Readable.from((async function* () {
      try {
        for await (const chunk of createReadStream(file.absolutePath)) yield chunk;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown upload read error';
        warnings.push(`${file.relativePath}: ${message}`);
        logger.warn(`Could not add upload file ${file.absolutePath} to system export: ${message}`);
      }
    })());
  }

  private createManifestExportStream(createManifest: () => string) {
    return Readable.from((async function* () {
      yield createManifest();
    })());
  }

  private serializeCsvValue(value: unknown) {
    if (value === null || typeof value === 'undefined') return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private normalizeRowsForImport(table: ManagedTable, rows: Array<Record<string, unknown>>) {
    return rows.map((row) => this.normalizeActivityImportRow(table, this.normalizeDateOnlyColumns(table, row)));
  }

  private normalizeActivityImportRow(table: ManagedTable, row: Record<string, unknown>) {
    if (table.key !== 'activities' || !Object.prototype.hasOwnProperty.call(table.columnTypes, 'executionStatus')) {
      return row;
    }

    const normalizedRow = { ...row };
    normalizedRow.executionStatus = normalizedRow.executionStatus === 'cancelled' ? 'cancelled' : 'completed';
    return normalizedRow;
  }

  private normalizeDateOnlyColumns(table: ManagedTable, row: Record<string, unknown>) {
    const normalizedRow = { ...row };
    for (const [column, value] of Object.entries(row || {})) {
      if (table.columnTypes[column] !== 'date') continue;
      normalizedRow[column] = this.normalizeDateOnlyValue(value);
    }
    return normalizedRow;
  }

  private normalizeDateOnlyValue(value: unknown) {
    if (value === null || typeof value === 'undefined' || value === '') return value;

    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

      const parsedDate = new Date(value);
      if (!Number.isNaN(parsedDate.getTime())) {
        return this.formatDateOnlyInLocalTime(parsedDate);
      }

      const prefixedDateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
      if (prefixedDateMatch?.[1]) return prefixedDateMatch[1];
      return value;
    }

    if (value instanceof Date) {
      return this.formatDateOnlyInLocalTime(value);
    }

    return value;
  }

  private formatDateOnlyInLocalTime(value: Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private escapeCsvValue(value: string) {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

}
