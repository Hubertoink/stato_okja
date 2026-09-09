import { mkdtemp, writeFile, utimes, stat, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { UploadMaintenanceService } from './upload-maintenance.service';
import { SystemDataUploadStore } from '../system-data/system-data-upload-store';

describe('UploadMaintenanceService', () => {
  it('preserves referenced, fresh and unknown files, removes aged orphans and reconciles quota sizes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stato-maintenance-'));
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const filenames = ['referenced.jpg', 'fresh.jpg', 'orphan.jpg', 'unknown.jpg'];
    try {
      for (const filename of filenames) {
        await writeFile(join(root, filename), 'image');
        await utimes(join(root, filename), old, old);
      }
      jest.spyOn(SystemDataUploadStore.prototype, 'scanUploads').mockResolvedValue({
        files: filenames.map((filename) => ({ absolutePath: join(root, filename), relativePath: `images/${filename}`, size: 5 })),
        fileCount: 4, totalBytes: 20, warnings: [],
      });
      const repository = {
        find: jest.fn().mockResolvedValue([
          ...filenames.slice(0, 3).map((filename) => ({ id: filename, filename, kind: 'image', size: 0, createdAt: filename === 'fresh.jpg' ? new Date() : old })),
          { id: 'missing', filename: 'missing.jpg', kind: 'image', createdAt: old },
          { id: 'reserved', filename: 'reserved.jpg', kind: 'image', createdAt: new Date() },
        ]),
        update: jest.fn(), delete: jest.fn(),
      };
      const service = new UploadMaintenanceService(
        { getRepository: () => repository } as never,
        { getReferencedUploadPaths: async () => new Set(['/uploads/images/referenced.jpg']) } as never,
      );
      await service.run();
      await expect(stat(join(root, 'orphan.jpg'))).rejects.toMatchObject({ code: 'ENOENT' });
      for (const filename of ['referenced.jpg', 'fresh.jpg', 'unknown.jpg']) {
        expect((await stat(join(root, filename))).isFile()).toBe(true);
      }
      expect(repository.delete).toHaveBeenCalledWith({ filename: 'orphan.jpg', kind: 'image' });
      expect(repository.delete).toHaveBeenCalledWith('missing');
      expect(repository.delete).toHaveBeenCalledTimes(2);
      expect(repository.update).toHaveBeenCalledWith({ filename: 'referenced.jpg', kind: 'image' }, { size: 5 });
    } finally {
      jest.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  });
});