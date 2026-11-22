import JSZip from 'jszip';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { createSystemDataArchive, restoreSystemDataArchive, SYSTEM_DATA_EXPORT_FORMAT, SYSTEM_DATA_EXPORT_SCHEMA_VERSION } from './system-data-archive';
import { SystemDataImportArchiveReader, type SystemDataManagedTable } from './system-data-import-archive-reader';

const actor = { id: 'snapshot-test', role: 'superadmin' };
const uploads = { fileCount: 0, totalBytes: 0, files: [], warnings: [] };

async function checkSnapshot(db: DataSource) {
  const name = 'archive_snapshot_' + process.pid + '_' + Date.now();
  const table: SystemDataManagedTable = { key: name, path: name, filename: name, columnTypes: {} };
  const temp = await mkdtemp(join(tmpdir(), 'stato-archive-snapshot-'));
  await db.query('CREATE TABLE "' + name + '" (id integer primary key)');
  try {
    await db.query('INSERT INTO "' + name + '" VALUES (1)');
    // Commit a new row after JSON starts but before the CSV query is issued.
    const writer = db.createQueryRunner();
    await writer.connect();
    try {
      let write: Promise<unknown> | undefined;
      const { stream } = await createSystemDataArchive({
        actor, uploads, tables: [table], dataSource: db, onComplete: async () => {},
        normalize: (_table, row) => {
          write ??= writer.query('INSERT INTO "' + name + '" VALUES (2)');
          return row;
        },
      });
      const chunks: Buffer[] = [];
      for await (const bytes of stream) chunks.push(bytes);
      await write;
      const archive = Buffer.concat(chunks);
      const zip = await JSZip.loadAsync(archive);
      const filePath = join(temp, 'export.zip');
      await writeFile(filePath, archive);
      const imported = await new SystemDataImportArchiveReader().read({
        filePath, originalFilename: 'export.zip', managedTables: [table], exportFormat: SYSTEM_DATA_EXPORT_FORMAT,
        schemaVersion: SYSTEM_DATA_EXPORT_SCHEMA_VERSION, normalizeRowsForImport: (_table, rows) => rows,
      });
      expect(imported.tables[0].rows).toEqual([{ id: 1 }]);
      expect(imported.manifest.tables?.[0].rowCount).toBe(1);
      expect(await zip.file('database/' + name + '.csv')!.async('string')).toBe('id\n1\n');
      expect(await db.query('SELECT id FROM "' + name + '" ORDER BY id')).toEqual([{ id: 1 }, { id: 2 }]);
    } finally { await writer.release(); }
  } finally {
    await db.query('DROP TABLE "' + name + '"');
    await rm(temp, { recursive: true, force: true });
  }
}

it('keeps one SQL.js view of all exported data while the live database changes', async () => {
  const db = await new DataSource({ type: 'sqljs' }).initialize();
  try { await checkSnapshot(db); } finally { await db.destroy(); }
});

const itPostgres = process.env.MIGRATION_TEST_POSTGRES === 'true' ? it : it.skip;
itPostgres('keeps PostgreSQL manifest, JSON and CSV consistent across a concurrent commit', async () => {
  const db = await new DataSource({ type: 'postgres',
    host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USERNAME || 'stato_migration_test', password: process.env.DB_PASSWORD || 'stato_migration_test',
    database: process.env.DB_DATABASE || 'stato_migration_test',
  }).initialize();
  try { await checkSnapshot(db); } finally { await db.destroy(); }
});

it.each(['rollback', 'commit'])('preserves the complete backup when the database %s outcome is unknown', async phase => {
  const runner = {
    connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(), rollbackTransaction: jest.fn(),
    release: jest.fn(), isTransactionActive: true,
  };
  const store = {
    stageImportedUploads: jest.fn().mockResolvedValue({ sessionRoot: 'stage' }),
    applyImportedUploads: jest.fn().mockResolvedValue({ backupRoot: 'backup' }),
    restorePreviousUploads: jest.fn(), removePath: jest.fn(),
  };
  const reconcileSizes = jest.fn();
  if (phase === 'rollback') {
    reconcileSizes.mockRejectedValue(new Error('sizes unavailable'));
    runner.rollbackTransaction.mockRejectedValue(new Error('rollback failed'));
  } else {
    runner.commitTransaction.mockRejectedValue(new Error('connection lost'));
  }
  await expect(restoreSystemDataArchive({
    dataSource: { createQueryRunner: () => runner } as unknown as DataSource,
    uploads: [], store: store as unknown as import('./system-data-upload-store').SystemDataUploadStore,
    replaceRows: async () => 1, reconcileSizes,
  })).rejects.toThrow('Restore-Status unklar');
  expect(runner.release).toHaveBeenCalled();
  expect(store.restorePreviousUploads).not.toHaveBeenCalled();
  expect(store.removePath.mock.calls).toEqual([['stage']]);
});
