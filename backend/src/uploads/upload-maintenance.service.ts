import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { stat, unlink } from 'fs/promises';
import { SystemDataService } from '../system-data/system-data.service';
import { SystemDataUploadStore } from '../system-data/system-data-upload-store';
import { StoredUpload } from './stored-upload.entity';

const ORPHAN_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class UploadMaintenanceService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(UploadMaintenanceService.name);
  private readonly store = new SystemDataUploadStore();
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;

  constructor(private readonly dataSource: DataSource, private readonly systemData: SystemDataService) {}

  async onApplicationBootstrap() {
    await this.run();
    this.timer = setInterval(() => void this.run(), 60 * 60 * 1000);
    this.timer.unref();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }

  run(): Promise<void> {
    if (!this.running) {
      this.running = this.reconcile().catch((error: unknown) => {
        this.logger.error('Upload maintenance failed', error instanceof Error ? error.stack : String(error));
      }).finally(() => { this.running = undefined; });
    }
    return this.running;
  }

  private async reconcile() {
    const referenced = await this.systemData.getReferencedUploadPaths();
    const scan = await this.store.scanUploads();
    if (scan.warnings.length) throw new Error(scan.warnings.join('; '));
    const repository = this.dataSource.getRepository(StoredUpload);
    const records = await repository.find();
    const recordsByFile = new Map<string, StoredUpload[]>();
    for (const record of records) {
      const key = `${record.kind}:${record.filename}`;
      recordsByFile.set(key, [...(recordsByFile.get(key) || []), record]);
    }
    const cutoff = Date.now() - ORPHAN_GRACE_MS;
    const present = new Set<string>();

    for (const file of scan.files) {
      const match = /^(images|process-files)\/([a-z0-9][a-z0-9_.-]*)$/i.exec(file.relativePath);
      if (!match) continue;
      const kind = match[1] === 'images' ? 'image' : 'process-file';
      const filename = match[2];
      const key = `${kind}:${filename}`;
      present.add(key);
      const access = recordsByFile.get(key) || [];
      const url = `/uploads/${kind === 'image' ? 'images' : 'files'}/${filename}`;
      const info = await stat(file.absolutePath);
      if (access.length && !referenced.has(url) && info.mtimeMs < cutoff && access.every((record) => record.createdAt.getTime() < cutoff)) {
        await unlink(file.absolutePath);
        await repository.delete({ filename, kind });
      } else if (access.some((record) => Number(record.size) !== file.size)) {
        await repository.update({ filename, kind }, { size: file.size });
      }
    }
    for (const record of records) {
      if (!present.has(`${record.kind}:${record.filename}`) && record.createdAt.getTime() < cutoff) {
        await repository.delete(record.id);
      }
    }
  }
}