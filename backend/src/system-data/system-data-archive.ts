import { InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { addAbortSignal, PassThrough, Readable } from 'node:stream';
import { once } from 'node:events';
import { DataSource, QueryRunner } from 'typeorm';
import type { SystemDataManagedTable as Table } from './system-data-import-archive-reader';
import type { AppliedImportUploads, ImportedUploadEntry, SystemDataUploadStore } from './system-data-upload-store';
import type { SystemDataActor } from './system-data.service';

type ExportArchive = import('archiver').Archiver;
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

export const SYSTEM_DATA_EXPORT_FORMAT = 'stato-system-data-export';
export const SYSTEM_DATA_EXPORT_SCHEMA_VERSION = 3;
type Row = Record<string, unknown>;
type ReadRows = (table: Table) => AsyncIterable<Row> | Iterable<Row>;
type ExportTotals = { managedTables: number; databaseRows: number; uploadFiles: number; uploadBytes: number };
type ExportOptions = {
  dataSource: DataSource;
  tables: Table[];
  uploads: Awaited<ReturnType<SystemDataUploadStore['scanUploads']>>;
  actor: SystemDataActor;
  normalize: (table: Table, row: Row) => Row;
  onComplete: (filename: string, totals: ExportTotals) => Promise<void>;
};

const logger = new Logger('SystemDataArchive');

function selectTable(table: Table) {
  const path = table.path.split('.').map(part => '"' + part.replace(/"/g, '""') + '"').join('.');
  return 'SELECT * FROM ' + path;
}

async function* readRows(runner: QueryRunner, table: Table, postgres: boolean, signal: AbortSignal) {
  const sql = selectTable(table);
  if (postgres) {
    const cursor: Readable = await runner.stream(sql);
    for await (const row of addAbortSignal(signal, cursor)) yield row as Row;
  } else {
    for (let offset = 0; ; offset += 1000) {
      signal.throwIfAborted();
      const rows: Row[] = await runner.query(sql + ' LIMIT 1000 OFFSET ' + offset);
      yield* rows;
      if (rows.length < 1000) return;
    }
  }
}

async function withSnapshot(
  dataSource: DataSource,
  tables: Table[],
  signal: AbortSignal,
  write: (read: ReadRows) => Promise<void>,
) {
  const runner = dataSource.createQueryRunner();
  try {
    const connection = await runner.connect();
    signal.throwIfAborted();
    if (dataSource.options.type === 'sqljs') {
      // SQL.js shares one in-memory connection with all writers. Capture every
      // table in one JS turn. An uncommitted writer must never enter the ZIP.
      if (runner.isTransactionActive) throw new ServiceUnavailableException('Datenbank wird geändert. Export bitte erneut starten.');
      const rows = new Map<Table, Row[]>();
      for (const table of tables) {
        const statement = connection.prepare(selectTable(table));
        try {
          const values: Row[] = [];
          while (statement.step()) values.push(statement.getAsObject());
          rows.set(table, values);
        } finally { statement.free(); }
      }
      await write(table => rows.get(table)!);
      return;
    }
    const postgres = dataSource.options.type === 'postgres';
    await runner.startTransaction(postgres ? 'REPEATABLE READ' : 'SERIALIZABLE');
    await write(table => readRows(runner, table, postgres, signal));
    await runner.commitTransaction();
  } finally {
    // SQL.js returns a shared runner. Never roll back another request's transaction.
    try {
      if (dataSource.options.type !== 'sqljs' && runner.isTransactionActive) await runner.rollbackTransaction();
    } finally {
      if (dataSource.options.type !== 'sqljs') await runner.release();
    }
  }
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : value instanceof Date ? value.toISOString()
    : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

async function append(archive: ExportArchive, stream: Readable, name: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const source = addAbortSignal(signal, stream);
  const done = once(archive, 'entry', { signal });
  const fail = (error: Error) => archive.destroy(error);
  source.on('error', fail);
  try {
    archive.append(source, { name });
    await done;
  } finally {
    source.destroy();
    // A delayed AbortError can still arrive after the entry listener rejects.
    source.once('close', () => source.off('error', fail));
  }
}

export async function createSystemDataArchive(options: ExportOptions) {
  const { tables, uploads, actor, normalize, onComplete } = options;
  if (uploads.warnings.length) throw new Error('Upload-Bestand konnte nicht vollständig gelesen werden.');
  const generatedAt = new Date().toISOString();
  const filename = 'stato-system-data-export-' + generatedAt.replace(/[:.]/g, '-') + '.zip';
  const { ZipArchive } = await loadArchiverModule();
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const stream = new PassThrough();
  const cancel = new AbortController();
  const { signal } = cancel;
  stream.on('close', () => {
    if (!stream.readableEnded) { cancel.abort(); archive.destroy(); }
  });
  archive.on('warning', error => archive.destroy(error));
  archive.on('error', error => { cancel.abort(error); stream.destroy(error); });
  archive.pipe(stream);

  async function writeArchive() {
    const manifestTables: Array<{ tableName: string; rowCount: number; files: string[] }> = [];
    const totals = { managedTables: tables.length, databaseRows: 0, uploadFiles: 0, uploadBytes: 0 };
    await withSnapshot(options.dataSource, tables, signal, async read => {
      for (const table of tables) {
        const prefix = 'database/' + table.filename;
        const files = [prefix + '.json', prefix + '.csv'];
        let rowCount = 0;
        const json = async function* () {
          yield '[\n';
          for await (const row of read(table)) {
            yield (rowCount++ ? ',\n' : '') + JSON.stringify(normalize(table, row));
          }
          yield '\n]\n';
        };
        const csv = async function* () {
          let columns: string[] | undefined;
          for await (const raw of read(table)) {
            const row = normalize(table, raw);
            if (!columns) {
              columns = Object.keys(row);
              yield columns.map(csvCell).join(',') + '\n';
            }
            yield columns.map(key => csvCell(row[key])).join(',') + '\n';
          }
        };
        await append(archive, Readable.from(json()), files[0], signal);
        await append(archive, Readable.from(csv()), files[1], signal);
        manifestTables.push({ tableName: table.filename, rowCount, files });
        totals.databaseRows += rowCount;
      }
    });
    const archivedUploads: Array<{ path: string; size: number }> = [];
    for (const file of uploads.files) {
      const input = createReadStream(file.absolutePath);
      await append(archive, input, 'uploads/' + file.relativePath, signal);
      archivedUploads.push({ path: file.relativePath, size: input.bytesRead });
      totals.uploadFiles++;
      totals.uploadBytes += input.bytesRead;
    }
    const manifest = {
      format: SYSTEM_DATA_EXPORT_FORMAT, schemaVersion: SYSTEM_DATA_EXPORT_SCHEMA_VERSION,
      generatedAt, generatedBy: { id: actor.id, name: actor.name ?? null, role: actor.role },
      totals, tables: manifestTables,
      uploads: { files: archivedUploads, warnings: uploads.warnings },
    };
    await append(archive, Readable.from([JSON.stringify(manifest, null, 2)]), 'manifest.json', signal);
    await archive.finalize();
    try { await onComplete(filename, totals); } catch (error) { logger.warn(error); }
  }

  void writeArchive().catch(error => {
    if (!signal.aborted) logger.error(error);
    archive.destroy(error);
    stream.destroy(error);
  });
  return { filename, stream };
}

/** Couples the database commit to a recoverable replacement of the upload mount. */
export async function restoreSystemDataArchive<T>(options: {
  dataSource: DataSource;
  uploads: ImportedUploadEntry[];
  store: SystemDataUploadStore;
  replaceRows: (runner: QueryRunner) => Promise<T>;
  reconcileSizes: (runner: QueryRunner) => Promise<void>;
}) {
  const { store, dataSource } = options;
  const runner = dataSource.createQueryRunner();
  const staged = await store.stageImportedUploads(options.uploads);
  let backup: AppliedImportUploads | undefined;
  let committing = false;
  try {
    await runner.connect();
    await runner.startTransaction();
    const result = await options.replaceRows(runner);
    backup = await store.applyImportedUploads(staged);
    await options.reconcileSizes(runner);
    committing = true;
    await runner.commitTransaction();
    const completedBackup = backup;
    backup = undefined;
    await store.removePath(completedBackup.backupRoot);
    return { result, fileCount: staged.fileCount, totalBytes: staged.totalBytes };
  } catch (error) {
    if (runner.isTransactionActive) {
      try {
        await runner.rollbackTransaction();
      } catch (rollbackError) {
        logger.error('Datenbank-Rollback fehlgeschlagen. Upload-Sicherung: ' + (backup?.backupRoot ?? 'noch nicht ausgetauscht'), rollbackError);
        throw new InternalServerErrorException('Restore-Status unklar. Sicherung und Datenbank anhand des Serverprotokolls prüfen.');
      }
    }
    if (backup && committing) {
      // A lost COMMIT response can leave the client believing the transaction
      // is active even though the server persisted it. Keep both file versions.
      logger.error('Datenbank-Commit nicht bestätigt. Upload-Sicherung: ' + backup.backupRoot, error);
      throw new InternalServerErrorException('Restore-Status unklar. Sicherung und Datenbank anhand des Serverprotokolls prüfen.');
    }
    if (backup) await store.restorePreviousUploads(backup);
    throw error;
  } finally {
    await store.removePath(staged.sessionRoot);
    await runner.release();
  }
}
