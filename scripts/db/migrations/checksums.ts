import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Migration immutability census.
 *
 * config/db/migration-checksums.json records the sha256 of every file under
 * supabase/migrations at the time it was reviewed. Once a migration is recorded it is
 * treated as applied somewhere and must never change: a changed or missing recorded file
 * fails closed. New files are reported and are only appended through an explicit,
 * reviewed `--record --reviewed` invocation.
 */

export const MIGRATION_CHECKSUMS_RELATIVE_PATH = path.join(
  'config',
  'db',
  'migration-checksums.json',
);
export const MIGRATIONS_RELATIVE_PATH = path.join('supabase', 'migrations');

export type ChecksumEntry = {
  readonly sha256: string;
  readonly bytes: number;
  readonly recordedAt: string;
  readonly reviewed: true;
};

export type ChecksumBaseline = {
  readonly schemaVersion: 1;
  readonly algorithm: 'sha256';
  readonly migrationsDirectory: 'supabase/migrations';
  readonly reviewedBaselineDate: string;
  readonly note: string;
  readonly files: Readonly<Record<string, ChecksumEntry>>;
};

export type CensusEntry = {
  readonly sha256: string;
  readonly bytes: number;
};

export type Census = Readonly<Record<string, CensusEntry>>;

export type ImmutabilityReport = {
  readonly verified: readonly string[];
  readonly changed: readonly string[];
  readonly missing: readonly string[];
  readonly unrecorded: readonly string[];
};

export const BASELINE_NOTE =
  'Recorded migrations are immutable. Historical migrations are NOT assumed safely replayable; see config/db/census.md.';

function sha256Hex(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function computeMigrationCensus(migrationsDirectory: string): Census {
  if (!existsSync(migrationsDirectory)) {
    throw new Error(`Migrations directory not found: ${migrationsDirectory}`);
  }
  const census: Record<string, CensusEntry> = {};
  const names = readdirSync(migrationsDirectory).sort();
  for (const name of names) {
    const filePath = path.join(migrationsDirectory, name);
    if (!statSync(filePath).isFile()) {
      continue;
    }
    const content = readFileSync(filePath);
    census[name] = { sha256: sha256Hex(content), bytes: content.byteLength };
  }
  return census;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEntry(name: string, value: unknown): ChecksumEntry {
  if (!isRecord(value)) {
    throw new Error(`Checksum entry for ${name} must be an object.`);
  }
  const { sha256, bytes, recordedAt, reviewed } = value;
  if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error(`Checksum entry for ${name} has an invalid sha256.`);
  }
  if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes < 0) {
    throw new Error(`Checksum entry for ${name} has an invalid byte count.`);
  }
  if (typeof recordedAt !== 'string' || Number.isNaN(Date.parse(recordedAt))) {
    throw new Error(`Checksum entry for ${name} has an invalid recordedAt timestamp.`);
  }
  if (reviewed !== true) {
    throw new Error(`Checksum entry for ${name} is not marked reviewed.`);
  }
  return { sha256, bytes, recordedAt, reviewed: true };
}

export function parseChecksumBaseline(text: string): ChecksumBaseline {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Migration checksum baseline is not valid JSON.');
  }
  if (!isRecord(raw)) {
    throw new Error('Migration checksum baseline must be a JSON object.');
  }
  if (raw.schemaVersion !== 1) {
    throw new Error('Migration checksum baseline schemaVersion must be 1.');
  }
  if (raw.algorithm !== 'sha256') {
    throw new Error('Migration checksum baseline algorithm must be sha256.');
  }
  if (raw.migrationsDirectory !== 'supabase/migrations') {
    throw new Error('Migration checksum baseline migrationsDirectory must be supabase/migrations.');
  }
  if (
    typeof raw.reviewedBaselineDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(raw.reviewedBaselineDate)
  ) {
    throw new Error('Migration checksum baseline reviewedBaselineDate must be YYYY-MM-DD.');
  }
  if (typeof raw.note !== 'string') {
    throw new Error('Migration checksum baseline note must be a string.');
  }
  if (!isRecord(raw.files)) {
    throw new Error('Migration checksum baseline files must be an object.');
  }
  const files: Record<string, ChecksumEntry> = {};
  for (const name of Object.keys(raw.files).sort()) {
    files[name] = parseEntry(name, raw.files[name]);
  }
  return {
    schemaVersion: 1,
    algorithm: 'sha256',
    migrationsDirectory: 'supabase/migrations',
    reviewedBaselineDate: raw.reviewedBaselineDate,
    note: raw.note,
    files,
  };
}

export function compareCensus(baseline: ChecksumBaseline, census: Census): ImmutabilityReport {
  const verified: string[] = [];
  const changed: string[] = [];
  const missing: string[] = [];
  for (const [name, recorded] of Object.entries(baseline.files)) {
    const actual = census[name];
    if (!actual) {
      missing.push(name);
    } else if (actual.sha256 !== recorded.sha256 || actual.bytes !== recorded.bytes) {
      changed.push(name);
    } else {
      verified.push(name);
    }
  }
  const unrecorded = Object.keys(census).filter((name) => !Object.hasOwn(baseline.files, name));
  return { verified, changed, missing, unrecorded };
}

export function isImmutabilitySatisfied(report: ImmutabilityReport): boolean {
  return report.changed.length === 0 && report.missing.length === 0;
}

export function createEmptyBaseline(reviewedBaselineDate: string): ChecksumBaseline {
  return {
    schemaVersion: 1,
    algorithm: 'sha256',
    migrationsDirectory: 'supabase/migrations',
    reviewedBaselineDate,
    note: BASELINE_NOTE,
    files: {},
  };
}

/** Append every unrecorded census file; recorded entries are never rewritten. */
export function recordUnrecorded(
  baseline: ChecksumBaseline,
  census: Census,
  recordedAt: string,
): ChecksumBaseline {
  const files: Record<string, ChecksumEntry> = { ...baseline.files };
  for (const name of Object.keys(census).sort()) {
    if (Object.hasOwn(files, name)) {
      continue;
    }
    const entry = census[name];
    files[name] = { sha256: entry.sha256, bytes: entry.bytes, recordedAt, reviewed: true };
  }
  const sorted: Record<string, ChecksumEntry> = {};
  for (const name of Object.keys(files).sort()) {
    sorted[name] = files[name];
  }
  return { ...baseline, files: sorted };
}

export function renderChecksumBaseline(baseline: ChecksumBaseline): string {
  return `${JSON.stringify(baseline, null, 2)}\n`;
}

export function renderImmutabilityReport(report: ImmutabilityReport): string {
  const lines = [
    `immutability: verified=${report.verified.length} unrecorded=${report.unrecorded.length} changed=${report.changed.length} missing=${report.missing.length}`,
  ];
  for (const name of report.changed) {
    lines.push(`immutability: CHANGED recorded migration ${name}`);
  }
  for (const name of report.missing) {
    lines.push(`immutability: MISSING recorded migration ${name}`);
  }
  for (const name of report.unrecorded) {
    lines.push(`immutability: unrecorded migration ${name}`);
  }
  return `${lines.join('\n')}\n`;
}
