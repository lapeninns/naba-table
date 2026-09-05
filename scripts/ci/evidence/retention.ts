import { lstatSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Local job-log retention: keep at most `maxAgeMs` of history and at most
 * `maxTotalBytes` on disk (defaults: 7 days / 10 GiB, see executor/config.ts).
 *
 * Only immediate child directories of `root` are considered job directories.
 * Symlinked children are never followed or deleted through; the root itself is
 * never removed.
 */
export interface RetentionPolicy {
  readonly maxAgeMs: number;
  readonly maxTotalBytes: number;
}

export interface RetentionReport {
  readonly scanned: number;
  readonly removed: readonly string[];
  readonly reasons: Readonly<Record<string, 'age' | 'size'>>;
  readonly bytesBefore: number;
  readonly bytesAfter: number;
}

interface JobDirectory {
  readonly name: string;
  readonly absolutePath: string;
  readonly newestMtimeMs: number;
  readonly bytes: number;
}

function measure(directory: string): { bytes: number; newestMtimeMs: number } {
  let bytes = 0;
  let newestMtimeMs = 0;
  const stack = [directory];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      const stats = lstatSync(entryPath);
      if (stats.isSymbolicLink()) continue;
      if (stats.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (stats.isFile()) {
        bytes += stats.size;
        newestMtimeMs = Math.max(newestMtimeMs, stats.mtimeMs);
      }
    }
  }
  return { bytes, newestMtimeMs };
}

export function applyLogRetention(
  root: string,
  policy: RetentionPolicy,
  now: () => number = Date.now,
): RetentionReport {
  const rootStats = statSync(root);
  if (!rootStats.isDirectory()) {
    throw new Error(`retention root ${root} is not a directory`);
  }
  const jobs: JobDirectory[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolutePath = path.join(root, entry.name);
    const stats = lstatSync(absolutePath);
    if (stats.isSymbolicLink() || !stats.isDirectory()) continue;
    const measured = measure(absolutePath);
    jobs.push({
      name: entry.name,
      absolutePath,
      bytes: measured.bytes,
      newestMtimeMs: Math.max(measured.newestMtimeMs, stats.mtimeMs),
    });
  }

  const bytesBefore = jobs.reduce((sum, job) => sum + job.bytes, 0);
  const cutoff = now() - policy.maxAgeMs;
  const removed: string[] = [];
  const reasons: Record<string, 'age' | 'size'> = {};
  let remaining: JobDirectory[] = [];
  for (const job of jobs) {
    if (job.newestMtimeMs < cutoff) {
      rmSync(job.absolutePath, { recursive: true, force: true });
      removed.push(job.name);
      reasons[job.name] = 'age';
    } else {
      remaining.push(job);
    }
  }

  remaining = remaining.sort((a, b) => a.newestMtimeMs - b.newestMtimeMs);
  let total = remaining.reduce((sum, job) => sum + job.bytes, 0);
  while (total > policy.maxTotalBytes && remaining.length > 0) {
    const oldest = remaining.shift() as JobDirectory;
    rmSync(oldest.absolutePath, { recursive: true, force: true });
    removed.push(oldest.name);
    reasons[oldest.name] = 'size';
    total -= oldest.bytes;
  }

  return { scanned: jobs.length, removed, reasons, bytesBefore, bytesAfter: total };
}
