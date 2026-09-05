import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { createMemoryS3 } from './recovery-fixtures';
import {
  backupStorageObjects,
  parseStorageObjectsManifest,
  StorageBackupError,
  validateObjectAgainstMetadata,
  verifyStorageObjectsBackup,
  type StorageSource,
} from '../../scripts/db/backup/storage-objects';

const KEY = Buffer.alloc(32, 9);

function source(
  files: Record<string, Buffer>,
  etagFor: (body: Buffer) => string | null,
): StorageSource {
  return {
    async listObjects(bucket) {
      return Object.entries(files).map(([path, body]) => ({
        bucket,
        path,
        sizeBytes: body.length,
        etag: etagFor(body),
        updatedAt: null,
        mimeType: 'image/png',
      }));
    },
    async downloadObject(_bucket, path) {
      const body = files[path];
      if (!body) throw new Error('missing');
      return body;
    },
  };
}

describe('storage object backup', () => {
  it('validates downloads against provider size and md5 etag metadata', () => {
    const body = Buffer.from('logo');
    const md5 = createHash('md5').update(body).digest('hex');
    expect(
      validateObjectAgainstMetadata(
        { bucket: 'b', path: 'p', sizeBytes: 4, etag: `"${md5}"`, updatedAt: null, mimeType: null },
        body,
      ),
    ).toEqual({ ok: true });
    expect(
      validateObjectAgainstMetadata(
        { bucket: 'b', path: 'p', sizeBytes: 5, etag: null, updatedAt: null, mimeType: null },
        body,
      ),
    ).toEqual({ ok: false, reason: 'size_mismatch' });
    expect(
      validateObjectAgainstMetadata(
        {
          bucket: 'b',
          path: 'p',
          sizeBytes: 4,
          etag: 'd41d8cd98f00b204e9800998ecf8427e',
          updatedAt: null,
          mimeType: null,
        },
        body,
      ),
    ).toEqual({ ok: false, reason: 'etag_mismatch' });
    // Multipart etags ("<md5>-<parts>") only check size.
    expect(
      validateObjectAgainstMetadata(
        { bucket: 'b', path: 'p', sizeBytes: 4, etag: `${md5}-2`, updatedAt: null, mimeType: null },
        body,
      ),
    ).toEqual({ ok: true });
  });

  it('encrypts every object, writes a manifest and verifies it back', async () => {
    const files = {
      'r1/logo.png': Buffer.from('logo-bytes'),
      'r2/menu.pdf': Buffer.from('menu-bytes'),
    };
    const s3 = createMemoryS3();
    const manifest = await backupStorageObjects({
      backupId: 'bk-20260904T120000Z-0badcafe',
      createdAt: '2026-09-04T12:00:00.000Z',
      buckets: ['restaurant-branding'],
      source: source(files, (body) => createHash('md5').update(body).digest('hex')),
      s3,
      key: KEY,
    });
    expect(manifest.objectCount).toBe(2);
    expect(manifest.totalBytes).toBe(20);
    for (const object of manifest.objects) {
      const stored = s3.objects.get(object.objectKey);
      expect(stored?.includes(files[object.path as keyof typeof files] ?? Buffer.alloc(0))).toBe(
        false,
      );
    }
    const reparsed = parseStorageObjectsManifest(
      JSON.parse(
        s3.objects
          .get('backups/bk-20260904T120000Z-0badcafe/storage-manifest.json')
          ?.toString('utf8') ?? '{}',
      ),
    );
    expect(await verifyStorageObjectsBackup({ manifest: reparsed, s3, key: KEY })).toEqual({
      ok: true,
      checked: 2,
      failures: [],
    });

    s3.objects.delete(reparsed.objects[0]?.objectKey ?? '');
    const broken = await verifyStorageObjectsBackup({ manifest: reparsed, s3, key: KEY });
    expect(broken.ok).toBe(false);
    expect(broken.failures[0]).toMatch(/missing/);
  });

  it('refuses to back up an object that fails metadata validation', async () => {
    const s3 = createMemoryS3();
    await expect(
      backupStorageObjects({
        backupId: 'bk-20260904T120000Z-0badcafe',
        createdAt: '2026-09-04T12:00:00.000Z',
        buckets: ['menus'],
        source: source({ 'x.pdf': Buffer.from('abc') }, () => 'd41d8cd98f00b204e9800998ecf8427e'),
        s3,
        key: KEY,
      }),
    ).rejects.toThrow(StorageBackupError);
    expect(s3.objects.size).toBe(0);
  });
});
