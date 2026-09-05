import { BACKUP_ID_PATTERN } from '../backup/manifest';
import type { S3Client } from '../backup/s3';

/** Locate the newest backup in the bucket. Backup ids sort lexically by creation time. */

export function pickLatestBackupId(keys: readonly string[]): string | null {
  const ids = keys
    .map((key) => key.match(/^backups\/(bk-[^/]+)\/manifest\.json$/)?.[1] ?? null)
    .filter((id): id is string => id !== null && BACKUP_ID_PATTERN.test(id))
    .sort();
  return ids.at(-1) ?? null;
}

export async function findLatestBackupId(s3: S3Client): Promise<string | null> {
  const objects = await s3.listObjects('backups/');
  return pickLatestBackupId(objects.map((object) => object.key));
}
