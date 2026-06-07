import { BadRequestException } from '@nestjs/common';
import JSZip from 'jszip';
import { readFile } from 'fs/promises';
import type { ImportedUploadEntry } from './system-data-upload-store';

export type SystemDataManagedTable = {
  key: string;
  path: string;
  filename: string;
  columnTypes: Record<string, string>;
};

export type SystemDataManifest = {
  format?: string;
  schemaVersion?: number;
  generatedAt?: string;
  generatedBy?: { id?: string; name?: string | null; role?: string } | null;
  totals?: {
    managedTables?: number;
    databaseRows?: number;
    uploadFiles?: number;
    uploadBytes?: number;
  };
  tables?: Array<{ tableName?: string; rowCount?: number; files?: string[] }>;
  uploads?: {
    files?: Array<{ path?: string; size?: number }>;
    warnings?: string[];
  };
};

export type ImportedTableData = SystemDataManagedTable & {
  rows: Array<Record<string, unknown>>;
};

export type ParsedImportArchive = {
  originalFilename: string;
  manifest: SystemDataManifest;
  tables: ImportedTableData[];
  uploads: ImportedUploadEntry[];
  warnings: string[];
};

export class SystemDataImportArchiveReader {
  async read(options: {
    filePath: string;
    originalFilename: string;
    managedTables: SystemDataManagedTable[];
    exportFormat: string;
    schemaVersion: number;
    normalizeRowsForImport: (
      table: SystemDataManagedTable,
      rows: Array<Record<string, unknown>>,
    ) => Array<Record<string, unknown>>;
  }): Promise<ParsedImportArchive> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(await readFile(options.filePath));
    } catch {
      throw new BadRequestException('Die ZIP-Datei konnte nicht gelesen werden.');
    }

    const manifestEntry = zip.file('manifest.json');
    if (!manifestEntry) {
      throw new BadRequestException('manifest.json fehlt im Archiv.');
    }

    let manifest: SystemDataManifest;
    try {
      manifest = JSON.parse(await manifestEntry.async('string')) as SystemDataManifest;
    } catch {
      throw new BadRequestException('manifest.json ist ungültig.');
    }

    const warnings: string[] = [];
    if (manifest.format && manifest.format !== options.exportFormat) {
      warnings.push(`Unbekanntes Exportformat: ${manifest.format}`);
    }
    if (typeof manifest.schemaVersion === 'number' && manifest.schemaVersion > options.schemaVersion) {
      throw new BadRequestException(`Archiv verwendet eine neuere Schema-Version (${manifest.schemaVersion}).`);
    }
    if (!manifest.format) {
      warnings.push('Archiv ohne Exportformat erkannt. Es wird als Legacy-Export behandelt.');
    }
    if (!manifest.schemaVersion) {
      warnings.push('Archiv ohne Schema-Version erkannt. Es wird als Legacy-Export behandelt.');
    }

    const manifestTableByName = new Map((manifest.tables || []).map((table) => [String(table.tableName || '').toLowerCase(), table]));
    const importedTables: ImportedTableData[] = [];

    for (const table of options.managedTables) {
      const manifestTable = manifestTableByName.get(table.filename);
      const jsonPath = manifestTable?.files?.find((file) => file.endsWith('.json')) || `database/${table.filename}.json`;
      const jsonEntry = zip.file(jsonPath);
      if (!jsonEntry) {
        throw new BadRequestException(`Archiv enthält keine JSON-Daten für Tabelle ${table.filename}.`);
      }

      let rows: Array<Record<string, unknown>>;
      try {
        const raw = JSON.parse(await jsonEntry.async('string'));
        if (!Array.isArray(raw)) {
          throw new Error('not-an-array');
        }
        rows = raw as Array<Record<string, unknown>>;
      } catch {
        throw new BadRequestException(`JSON-Daten für Tabelle ${table.filename} sind ungültig.`);
      }

      if (typeof manifestTable?.rowCount === 'number' && manifestTable.rowCount !== rows.length) {
        throw new BadRequestException(`Row-Count-Abweichung in Tabelle ${table.filename}.`);
      }

      importedTables.push({ ...table, rows: options.normalizeRowsForImport(table, rows) });
    }

    const knownTableJsonPaths = new Set(importedTables.map((table) => `database/${table.filename}.json`));
    for (const path of Object.keys(zip.files)) {
      if (path.startsWith('database/') && path.endsWith('.json') && !knownTableJsonPaths.has(path)) {
        warnings.push(`Zusätzliche Archivdatei wird ignoriert: ${path}`);
      }
    }

    const manifestUploadSizes = new Map(
      (manifest.uploads?.files || [])
        .filter((file): file is { path: string; size?: number } => typeof file?.path === 'string' && file.path.trim().length > 0)
        .map((file) => [file.path, Number(file.size || 0)]),
    );

    const uploads = Object.values(zip.files)
      .filter((entry): entry is JSZip.JSZipObject => Boolean(entry) && !entry.dir && entry.name.startsWith('uploads/'))
      .map((entry) => {
        const relativePath = entry.name.slice('uploads/'.length);
        return {
          relativePath,
          size: manifestUploadSizes.get(relativePath) || 0,
          entry,
        } satisfies ImportedUploadEntry;
      })
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

    if (manifest.uploads?.warnings?.length) {
      warnings.push(...manifest.uploads.warnings.map((warning) => `Export-Hinweis: ${warning}`));
    }

    return {
      originalFilename: options.originalFilename,
      manifest,
      tables: importedTables,
      uploads,
      warnings,
    };
  }
}
