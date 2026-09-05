import { existsSync, mkdirSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { applyLogRetention } from '@/scripts/ci/evidence/retention';

import { cleanupTempDirs, makeTempDir } from '../executor/helpers';

afterEach(cleanupTempDirs);

const DAY = 24 * 60 * 60 * 1000;

function job(root: string, name: string, ageDays: number, bytes: number): string {
  const dir = path.join(root, name);
  mkdirSync(path.join(dir, 'evidence'), { recursive: true });
  const file = path.join(dir, 'evidence', 'log.txt');
  writeFileSync(file, 'x'.repeat(bytes));
  const mtime = new Date(Date.now() - ageDays * DAY);
  utimesSync(file, mtime, mtime);
  utimesSync(dir, mtime, mtime);
  return dir;
}

describe('applyLogRetention', () => {
  it('removes job directories older than the max age', () => {
    const root = makeTempDir();
    const old = job(root, 'ci-old', 9, 10);
    const fresh = job(root, 'ci-fresh', 1, 10);
    const report = applyLogRetention(root, { maxAgeMs: 7 * DAY, maxTotalBytes: 10 * 1024 ** 3 });
    expect(report.removed).toEqual(['ci-old']);
    expect(report.reasons).toEqual({ 'ci-old': 'age' });
    expect(existsSync(old)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
    expect(report.scanned).toBe(2);
    expect(report.bytesBefore).toBe(20);
    expect(report.bytesAfter).toBe(10);
  });

  it('removes the oldest directories first until the total fits the byte cap', () => {
    const root = makeTempDir();
    job(root, 'ci-a', 3, 400);
    job(root, 'ci-b', 2, 400);
    job(root, 'ci-c', 1, 400);
    const report = applyLogRetention(root, { maxAgeMs: 30 * DAY, maxTotalBytes: 900 });
    expect(report.removed).toEqual(['ci-a']);
    expect(report.reasons['ci-a']).toBe('size');
    expect(report.bytesAfter).toBe(800);
    expect(existsSync(path.join(root, 'ci-b'))).toBe(true);
  });

  it('never follows or deletes through symlinked children and leaves files at the root alone', () => {
    const root = makeTempDir();
    const outside = makeTempDir();
    writeFileSync(path.join(outside, 'keep.txt'), 'keep');
    symlinkSync(outside, path.join(root, 'ci-link'));
    writeFileSync(path.join(root, 'notes.txt'), 'root file');
    const report = applyLogRetention(
      root,
      { maxAgeMs: 0, maxTotalBytes: 0 },
      () => Date.now() + DAY,
    );
    expect(report.removed).toEqual([]);
    expect(existsSync(path.join(outside, 'keep.txt'))).toBe(true);
    expect(existsSync(path.join(root, 'notes.txt'))).toBe(true);
  });

  it('refuses a root that is not a directory', () => {
    const root = makeTempDir();
    const file = path.join(root, 'file');
    writeFileSync(file, 'x');
    expect(() => applyLogRetention(file, { maxAgeMs: DAY, maxTotalBytes: 1 })).toThrow(
      /not a directory/u,
    );
  });
});
