import { createHash } from 'node:crypto';

import { decryptBuffer, encryptBuffer } from './encrypt';
import type { FetchLike, S3Client } from './s3';

/**
 * Supabase Storage object backup. Objects are listed, downloaded, validated against
 * the provider metadata (size + md5 etag when available), hashed, encrypted with the
 * backup key and uploaded to the encrypted backup bucket under the backup id.
 */

export type StorageObjectMeta = {
  readonly bucket: string;
  readonly path: string;
  readonly sizeBytes: number | null;
  readonly etag: string | null;
  readonly updatedAt: string | null;
  readonly mimeType: string | null;
};

export type StorageSource = {
  listObjects(bucket: string): Promise<readonly StorageObjectMeta[]>;
  downloadObject(bucket: string, path: string): Promise<Buffer>;
};

export type StorageObjectRecord = {
  readonly bucket: string;
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly etag: string | null;
  readonly objectKey: string;
  readonly encryptedSizeBytes: number;
};

export type StorageObjectsManifest = {
  readonly manifestVersion: 1;
  readonly backupId: string;
  readonly createdAt: string;
  readonly buckets: readonly string[];
  readonly objectCount: number;
  readonly totalBytes: number;
  readonly objects: readonly StorageObjectRecord[];
};

export class StorageBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageBackupError';
  }
}

export type MetadataValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'size_mismatch' | 'etag_mismatch' };

/** Validate a downloaded body against provider metadata. Multipart etags only check size. */
export function validateObjectAgainstMetadata(
  meta: StorageObjectMeta,
  body: Buffer,
): MetadataValidation {
  if (meta.sizeBytes !== null && meta.sizeBytes !== body.length) {
    return { ok: false, reason: 'size_mismatch' };
  }
  const etag = meta.etag?.replace(/"/g, '') ?? null;
  if (etag && /^[a-f0-9]{32}$/i.test(etag)) {
    const md5 = createHash('md5').update(body).digest('hex');
    if (md5.toLowerCase() !== etag.toLowerCase()) {
      return { ok: false, reason: 'etag_mismatch' };
    }
  }
  return { ok: true };
}

export function storageObjectKey(backupId: string, bucket: string, path: string): string {
  return `backups/${backupId}/storage/${bucket}/${path}.enc`;
}

export function storageManifestKey(backupId: string): string {
  return `backups/${backupId}/storage-manifest.json`;
}

export type BackupStorageObjectsInput = {
  readonly backupId: string;
  readonly createdAt: string;
  readonly buckets: readonly string[];
  readonly source: StorageSource;
  readonly s3: S3Client;
  readonly key: Buffer;
  readonly ivFactory?: () => Buffer;
};

export async function backupStorageObjects(
  input: BackupStorageObjectsInput,
): Promise<StorageObjectsManifest> {
  const objects: StorageObjectRecord[] = [];
  for (const bucket of input.buckets) {
    const listed = await input.source.listObjects(bucket);
    for (const meta of listed) {
      const body = await input.source.downloadObject(bucket, meta.path);
      const validation = validateObjectAgainstMetadata(meta, body);
      if (!validation.ok) {
        throw new StorageBackupError(
          `Storage object ${bucket}/${meta.path} failed metadata validation (${validation.reason}).`,
        );
      }
      const encrypted = encryptBuffer(input.key, body, input.ivFactory?.());
      const objectKey = storageObjectKey(input.backupId, bucket, meta.path);
      await input.s3.putObject(objectKey, encrypted);
      objects.push({
        bucket,
        path: meta.path,
        sizeBytes: body.length,
        sha256: createHash('sha256').update(body).digest('hex'),
        etag: meta.etag,
        objectKey,
        encryptedSizeBytes: encrypted.length,
      });
    }
  }
  const manifest: StorageObjectsManifest = {
    manifestVersion: 1,
    backupId: input.backupId,
    createdAt: input.createdAt,
    buckets: input.buckets,
    objectCount: objects.length,
    totalBytes: objects.reduce((total, object) => total + object.sizeBytes, 0),
    objects,
  };
  await input.s3.putObject(
    storageManifestKey(input.backupId),
    Buffer.from(JSON.stringify(manifest, null, 2)),
    {
      contentType: 'application/json',
    },
  );
  return manifest;
}

export type StorageVerificationResult = {
  readonly ok: boolean;
  readonly checked: number;
  readonly failures: readonly string[];
};

/** Restore-side check: every recorded object decrypts and hashes to the recorded digest. */
export async function verifyStorageObjectsBackup(input: {
  readonly manifest: StorageObjectsManifest;
  readonly s3: S3Client;
  readonly key: Buffer;
}): Promise<StorageVerificationResult> {
  const failures: string[] = [];
  let checked = 0;
  for (const object of input.manifest.objects) {
    const encrypted = await input.s3.getObject(object.objectKey);
    if (!encrypted) {
      failures.push(`${object.bucket}/${object.path}: missing`);
      continue;
    }
    try {
      const body = decryptBuffer(input.key, encrypted);
      const sha256 = createHash('sha256').update(body).digest('hex');
      if (sha256 !== object.sha256 || body.length !== object.sizeBytes) {
        failures.push(`${object.bucket}/${object.path}: digest mismatch`);
      }
    } catch {
      failures.push(`${object.bucket}/${object.path}: decrypt failed`);
    }
    checked += 1;
  }
  return { ok: failures.length === 0 && checked === input.manifest.objectCount, checked, failures };
}

export function parseStorageObjectsManifest(raw: unknown): StorageObjectsManifest {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new StorageBackupError('storage manifest must be an object.');
  }
  const record = raw as Record<string, unknown>;
  if (
    record.manifestVersion !== 1 ||
    typeof record.backupId !== 'string' ||
    !Array.isArray(record.objects)
  ) {
    throw new StorageBackupError('storage manifest shape is invalid.');
  }
  const objects = record.objects.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new StorageBackupError(`storage manifest object[${index}] is invalid.`);
    }
    const object = entry as Record<string, unknown>;
    if (
      typeof object.bucket !== 'string' ||
      typeof object.path !== 'string' ||
      typeof object.sizeBytes !== 'number' ||
      typeof object.sha256 !== 'string' ||
      typeof object.objectKey !== 'string' ||
      typeof object.encryptedSizeBytes !== 'number'
    ) {
      throw new StorageBackupError(`storage manifest object[${index}] is missing fields.`);
    }
    return {
      bucket: object.bucket,
      path: object.path,
      sizeBytes: object.sizeBytes,
      sha256: object.sha256,
      etag: typeof object.etag === 'string' ? object.etag : null,
      objectKey: object.objectKey,
      encryptedSizeBytes: object.encryptedSizeBytes,
    };
  });
  if (record.objectCount !== objects.length) {
    throw new StorageBackupError('storage manifest objectCount does not match objects.');
  }
  return {
    manifestVersion: 1,
    backupId: record.backupId,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
    buckets: Array.isArray(record.buckets)
      ? record.buckets.filter((b): b is string => typeof b === 'string')
      : [],
    objectCount: objects.length,
    totalBytes: objects.reduce((total, object) => total + object.sizeBytes, 0),
    objects,
  };
}

export const STORAGE_BACKUP_ENV = {
  apiUrl: 'STORAGE_BACKUP_API_URL',
  token: 'STORAGE_BACKUP_TOKEN',
} as const;

type SupabaseListEntry = {
  readonly name: string;
  readonly id: string | null;
  readonly updated_at?: string | null;
  readonly metadata?: {
    readonly size?: number;
    readonly eTag?: string;
    readonly mimetype?: string;
  } | null;
};

/** Real Supabase Storage source (list + download via the storage REST API). */
export function createSupabaseStorageSource(config: {
  readonly apiUrl: string;
  readonly token: string;
  readonly fetch: FetchLike;
  readonly pageSize?: number;
}): StorageSource {
  const base = config.apiUrl.replace(/\/$/, '');
  const headers = { authorization: `Bearer ${config.token}`, apikey: config.token };
  const pageSize = config.pageSize ?? 1000;

  async function listPrefix(
    bucket: string,
    prefix: string,
    into: StorageObjectMeta[],
  ): Promise<void> {
    let offset = 0;
    for (;;) {
      const response = await config.fetch(
        `${base}/storage/v1/object/list/${encodeURIComponent(bucket)}`,
        {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({
            prefix,
            limit: pageSize,
            offset,
            sortBy: { column: 'name', order: 'asc' },
          }),
        },
      );
      if (!response.ok) {
        throw new StorageBackupError(
          `Listing ${bucket}/${prefix} failed with status ${response.status}.`,
        );
      }
      const entries = (await response.json()) as SupabaseListEntry[];
      for (const entry of entries) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) {
          await listPrefix(bucket, path, into);
          continue;
        }
        into.push({
          bucket,
          path,
          sizeBytes: typeof entry.metadata?.size === 'number' ? entry.metadata.size : null,
          etag: entry.metadata?.eTag ?? null,
          updatedAt: entry.updated_at ?? null,
          mimeType: entry.metadata?.mimetype ?? null,
        });
      }
      if (entries.length < pageSize) return;
      offset += entries.length;
    }
  }

  return {
    async listObjects(bucket) {
      const objects: StorageObjectMeta[] = [];
      await listPrefix(bucket, '', objects);
      return objects;
    },
    async downloadObject(bucket, path) {
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      const response = await config.fetch(
        `${base}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodedPath}`,
        { method: 'GET', headers },
      );
      if (!response.ok) {
        throw new StorageBackupError(
          `Download ${bucket}/${path} failed with status ${response.status}.`,
        );
      }
      return Buffer.from(await response.arrayBuffer());
    },
  };
}
