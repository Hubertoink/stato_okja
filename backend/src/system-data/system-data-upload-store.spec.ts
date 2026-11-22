import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
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

  async function restoreFixture() {
    const sessionRoot = join(testRoot, 'restore');
    const staged = { sessionRoot, uploadsRoot: join(sessionRoot, 'uploads'), fileCount: 1, totalBytes: 3 };
    await mkdir(staged.uploadsRoot, { recursive: true });
    await writeFile(join(staged.uploadsRoot, 'new'), 'new');
    await writeFile(join(uploadsRoot, 'old-1'), 'one');
    await writeFile(join(uploadsRoot, 'old-2'), 'two');
    return staged;
  }

  it.each(['copyFile', 'readdir'] as const)('leaves the entire live tree intact if backup %s fails', async (operation) => {
    const staged = await restoreFixture();
    const fs = jest.requireActual<typeof import('fs/promises')>('fs/promises');
    const failure = new Error('backup failed');
    const spy = operation === 'copyFile'
      ? jest.spyOn(fs, 'copyFile').mockImplementationOnce(fs.copyFile).mockRejectedValueOnce(failure)
      : jest.spyOn(fs, 'readdir').mockRejectedValueOnce(failure);
    try {
      await expect(store.applyImportedUploads(staged)).rejects.toThrow(failure);
    } finally { spy.mockRestore(); }
    expect(await readFile(join(uploadsRoot, 'old-1'), 'utf8')).toBe('one');
    expect(await readFile(join(uploadsRoot, 'old-2'), 'utf8')).toBe('two');
    expect(await readdir(testRoot)).not.toContainEqual(expect.stringContaining('uploads-backup'));
  });

  it('restores both originals if copying the new data fails after replacement starts', async () => {
    const staged = await restoreFixture();
    const fs = jest.requireActual<typeof import('fs/promises')>('fs/promises');
    const copy = fs.copyFile;
    const spy = jest.spyOn(fs, 'copyFile').mockImplementation((src, dest, ...args) =>
      String(src) === join(staged.uploadsRoot, 'new') ? Promise.reject(new Error('disk full')) : copy(src, dest, ...args));
    try { await expect(store.applyImportedUploads(staged)).rejects.toThrow('disk full'); }
    finally { spy.mockRestore(); }
    expect(await readFile(join(uploadsRoot, 'old-1'), 'utf8')).toBe('one');
    expect(await readFile(join(uploadsRoot, 'old-2'), 'utf8')).toBe('two');
    expect(await readdir(testRoot)).not.toContainEqual(expect.stringContaining('uploads-backup'));
  });

  it('keeps the complete backup available if automatic rollback itself fails', async () => {
    const staged = await restoreFixture();
    const applied = await store.applyImportedUploads(staged);
    const fs = jest.requireActual<typeof import('fs/promises')>('fs/promises');
    const spy = jest.spyOn(fs, 'copyFile').mockRejectedValueOnce(new Error('destination unavailable'));
    try { await expect(store.restorePreviousUploads(applied)).rejects.toThrow('Sicherungspfad'); }
    finally { spy.mockRestore(); }
    expect(await readFile(join(applied.backupRoot, 'old-1'), 'utf8')).toBe('one');
    expect(await readFile(join(applied.backupRoot, 'old-2'), 'utf8')).toBe('two');
    await store.restorePreviousUploads(applied);
    expect(await readFile(join(uploadsRoot, 'old-2'), 'utf8')).toBe('two');
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
