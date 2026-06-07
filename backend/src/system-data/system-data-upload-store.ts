import { InternalServerErrorException, Logger } from '@nestjs/common';
import { copyFile, mkdir, mkdtemp, readdir, rm, stat, unlink, writeFile } from 'fs/promises';
import { dirname, join, relative } from 'path';
import type JSZip from 'jszip';

export type UploadFileEntry = {
  absolutePath: string;
  relativePath: string;
  size: number;
};

export type ImportedUploadEntry = {
  relativePath: string;
  size: number;
  entry: JSZip.JSZipObject;
};

export type StagedImportUploads = {
  sessionRoot: string;
  uploadsRoot: string;
  fileCount: number;
  totalBytes: number;
};

export type AppliedImportUploads = {
  backupRoot: string | null;
  uploadsRoot: string;
};

export class SystemDataUploadStore {
  private readonly logger = new Logger(SystemDataUploadStore.name);

  async scanUploads(): Promise<{
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

  async clearUploads() {
    const uploadsRoot = join(process.cwd(), 'uploads');
    const scan = await this.scanUploads();
    const warnings = [...scan.warnings];

    try {
      await rm(uploadsRoot, { recursive: true, force: true });
      await mkdir(join(uploadsRoot, 'images'), { recursive: true });
      await mkdir(join(uploadsRoot, 'project-documents'), { recursive: true });
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

  async stageImportedUploads(uploads: ImportedUploadEntry[]): Promise<StagedImportUploads> {
    const tempRoot = join(process.cwd(), '.tmp');
    await mkdir(tempRoot, { recursive: true });
    const sessionRoot = await mkdtemp(join(tempRoot, 'system-data-restore-'));
    const uploadsRoot = join(sessionRoot, 'uploads');
    await mkdir(join(uploadsRoot, 'images'), { recursive: true });

    let totalBytes = 0;
    for (const upload of uploads) {
      const targetPath = join(uploadsRoot, upload.relativePath);
      await mkdir(dirname(targetPath), { recursive: true });
      const buffer = await upload.entry.async('nodebuffer');
      totalBytes += buffer.length;
      await writeFile(targetPath, buffer);
    }

    return {
      sessionRoot,
      uploadsRoot,
      fileCount: uploads.length,
      totalBytes,
    };
  }

  async applyImportedUploads(stagedUploads: StagedImportUploads): Promise<AppliedImportUploads> {
    const uploadsRoot = join(process.cwd(), 'uploads');
    const backupRoot = `${stagedUploads.sessionRoot}-uploads-backup`;

    try {
      await mkdir(uploadsRoot, { recursive: true });
      await rm(backupRoot, { recursive: true, force: true });

      if (await this.pathExists(uploadsRoot)) {
        await mkdir(backupRoot, { recursive: true });
        await this.copyDirectoryContents(uploadsRoot, backupRoot);
      }

      await this.clearDirectoryContents(uploadsRoot);
      await this.copyDirectoryContents(stagedUploads.uploadsRoot, uploadsRoot);

      return {
        backupRoot: (await this.pathExists(backupRoot)) ? backupRoot : null,
        uploadsRoot,
      };
    } catch (error) {
      if (await this.pathExists(backupRoot)) {
        await this.restorePreviousUploads({ backupRoot, uploadsRoot });
      }

      const message = error instanceof Error ? error.message : 'unbekannter Upload-Fehler';
      throw new InternalServerErrorException(`Upload-Dateien konnten nicht wiederhergestellt werden: ${message}`);
    }
  }

  async restorePreviousUploads(appliedUploads: AppliedImportUploads) {
    const { uploadsRoot, backupRoot } = appliedUploads;

    await mkdir(uploadsRoot, { recursive: true });
    await this.clearDirectoryContents(uploadsRoot);

    if (backupRoot && await this.pathExists(backupRoot)) {
      await this.copyDirectoryContents(backupRoot, uploadsRoot);
      return;
    }

    await mkdir(join(uploadsRoot, 'images'), { recursive: true });
    await mkdir(join(uploadsRoot, 'project-documents'), { recursive: true });
  }

  async removePath(path: string) {
    if (!path) return;
    try {
      await rm(path, { recursive: true, force: true });
    } catch {
      try {
        await unlink(path);
      } catch {
        /* ignore cleanup errors */
      }
    }
  }

  private async copyDirectoryContents(sourceDir: string, targetDir: string) {
    await mkdir(targetDir, { recursive: true });
    let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }> = [];
    try {
      entries = await readdir(sourceDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const sourcePath = join(sourceDir, entry.name);
      const targetPath = join(targetDir, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectoryContents(sourcePath, targetPath);
        continue;
      }

      if (entry.isFile()) {
        await mkdir(dirname(targetPath), { recursive: true });
        await copyFile(sourcePath, targetPath);
      }
    }
  }

  private async clearDirectoryContents(directory: string) {
    let entries: Array<{ name: string }> = [];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      await rm(join(directory, entry.name), { recursive: true, force: true });
    }
  }

  private async pathExists(path: string) {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }
}
