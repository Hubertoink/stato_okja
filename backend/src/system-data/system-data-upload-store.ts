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
  backupRoot: string;
  uploadsRoot: string;
};

export class SystemDataUploadStore {
  private readonly logger = new Logger(SystemDataUploadStore.name);

  constructor(private readonly uploadsRoot = join(process.cwd(), 'uploads')) {}

  async scanUploads(): Promise<{
    files: UploadFileEntry[];
    fileCount: number;
    totalBytes: number;
    warnings: string[];
    rootMissing?: true;
  }> {
    const uploadsRoot = this.uploadsRoot;
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
    } catch (error) {
      // A fresh installation can have no uploads directory before its first write.
      // Its absence cannot establish that previously registered files are gone.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { files: [], fileCount: 0, totalBytes: 0, warnings: [], rootMissing: true };
      }
      throw error;
    }
    await walk(uploadsRoot);

    return {
      files,
      fileCount: files.length,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      warnings,
    };
  }

  async clearUploads() {
    const uploadsRoot = this.uploadsRoot;
    const scan = await this.scanUploads();
    const warnings = [...scan.warnings];

    try {
      // The uploads directory is a Docker volume mount in production and the
      // mount point itself cannot be removed (EBUSY). Clear its contents instead.
      await mkdir(uploadsRoot, { recursive: true });
      await this.clearDirectoryContents(uploadsRoot);
      await mkdir(join(uploadsRoot, 'images'), { recursive: true });
      await mkdir(join(uploadsRoot, 'project-documents'), { recursive: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown upload cleanup error';
      this.logger.error(`Upload cleanup failed: ${message}`);
      throw new InternalServerErrorException(`Upload-Dateien konnten nicht vollständig gelöscht werden: ${message}`);
    }

    const verification = await this.scanUploads();
    if (verification.rootMissing || verification.warnings.length) {
      throw new InternalServerErrorException('Die Löschung der Upload-Dateien konnte nicht überprüft werden.');
    }
    if (verification.fileCount > 0) {
      throw new InternalServerErrorException(
        `Upload-Dateien konnten nicht vollständig gelöscht werden (${verification.fileCount} Dateien verbleiben).`,
      );
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
    try {
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
    } catch (error) {
      await this.removePath(sessionRoot);
      throw error;
    }
  }

  async applyImportedUploads(stagedUploads: StagedImportUploads): Promise<AppliedImportUploads> {
    const uploadsRoot = this.uploadsRoot;
    // The mount point itself must survive a restore (Docker volumes).
    await mkdir(uploadsRoot, { recursive: true });
    const backupRoot = await mkdtemp(stagedUploads.sessionRoot + '-uploads-backup-');
    const backup = { uploadsRoot, backupRoot };
    try {
      await this.copyDirectoryContents(uploadsRoot, backupRoot);
    } catch (error) {
      await this.removePath(backupRoot);
      throw error;
    }
    // Only a complete backup can reach the first destructive operation.
    try {
      await this.clearDirectoryContents(uploadsRoot);
      await this.copyDirectoryContents(stagedUploads.uploadsRoot, uploadsRoot);
      return backup;
    } catch (error) {
      await this.restorePreviousUploads(backup);
      throw error;
    }
  }

  async restorePreviousUploads({ uploadsRoot, backupRoot }: AppliedImportUploads) {
    try {
      await readdir(backupRoot);
      await mkdir(uploadsRoot, { recursive: true });
      await this.clearDirectoryContents(uploadsRoot);
      await this.copyDirectoryContents(backupRoot, uploadsRoot);
    } catch (error) {
      this.logger.error(`Rücksicherung fehlgeschlagen. Vollständige Sicherung für manuelle Wiederherstellung: ${backupRoot}`, error);
      throw new InternalServerErrorException('Upload-Rücksicherung fehlgeschlagen. Der Sicherungspfad steht im Serverprotokoll.');
    }
    await this.removePath(backupRoot);
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
    const entries = await readdir(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = join(sourceDir, entry.name);
      const targetPath = join(targetDir, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectoryContents(sourcePath, targetPath);
        continue;
      }

      if (!entry.isFile()) throw new Error('Nicht unterstützter Dateityp im Upload-Verzeichnis: ' + sourcePath);
      await copyFile(sourcePath, targetPath);
    }
  }

  private async clearDirectoryContents(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      await this.removeEntryWithRetry(join(directory, entry.name));
    }
  }

  private async removeEntryWithRetry(path: string) {
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await rm(path, { recursive: true, force: true });
        return;
      } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error
          ? String((error as { code?: string }).code || '')
          : '';
        const isTransient = code === 'EPERM' || code === 'EBUSY' || code === 'EMFILE' || code === 'ENFILE';
        if (!isTransient || attempt === maxAttempts) throw error;
        await new Promise<void>((resolve) => setTimeout(resolve, 75 * attempt));
      }
    }
  }

}
