import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { SystemDataUploadStore } from './system-data-upload-store';

describe('SystemDataUploadStore', () => {
  let testRoot: string;
  let uploadsRoot: string;
  let store: SystemDataUploadStore;

  beforeEach(async () => {
    testRoot = await mkdtemp(join(tmpdir(), 'stato-upload-store-'));
    uploadsRoot = join(testRoot, 'uploads');
    await mkdir(join(uploadsRoot, 'images'), { recursive: true });
    await mkdir(join(uploadsRoot, 'project-documents'), { recursive: true });
    store = new SystemDataUploadStore(uploadsRoot);
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('clears files without deleting the uploads mount point', async () => {
    await writeFile(join(uploadsRoot, 'images', 'avatar.jpg'), Buffer.from('avatar'));
    await writeFile(join(uploadsRoot, 'project-documents', 'notes.pdf'), Buffer.from('notes'));

    const result = await store.clearUploads();
    const verification = await store.scanUploads();

    expect(result).toMatchObject({ deletedFiles: 2, deletedBytes: 11, warnings: [] });
    expect(verification.fileCount).toBe(0);

    await writeFile(join(uploadsRoot, 'images', 'after-purge.jpg'), Buffer.from('ok'));
    expect(await readFile(join(uploadsRoot, 'images', 'after-purge.jpg'), 'utf8')).toBe('ok');
  });

  it('replaces stale uploads completely when applying an imported backup', async () => {
    await writeFile(join(uploadsRoot, 'images', 'stale.jpg'), Buffer.from('stale'));

    const sessionRoot = join(testRoot, 'restore-session');
    const stagedRoot = join(sessionRoot, 'uploads');
    await mkdir(join(stagedRoot, 'images'), { recursive: true });
    await writeFile(join(stagedRoot, 'images', 'restored.jpg'), Buffer.from('restored'));

    const applied = await store.applyImportedUploads({
      sessionRoot,
      uploadsRoot: stagedRoot,
      fileCount: 1,
      totalBytes: 8,
    });
    const verification = await store.scanUploads();

    expect(verification.files.map((file) => file.relativePath)).toEqual(['images/restored.jpg']);
    expect(await readFile(join(uploadsRoot, 'images', 'restored.jpg'), 'utf8')).toBe('restored');

    await store.restorePreviousUploads(applied);
    expect((await store.scanUploads()).files.map((file) => file.relativePath)).toEqual(['images/stale.jpg']);
  });
});
