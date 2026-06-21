import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('performance script safety', () => {
  it('creates the baseline artifact directory and exits non-zero on fatal errors', () => {
    const source = read('scripts/db-perf-baseline.ts');

    expect(source).toContain('DB_PERF_BASELINE_OUTPUT_PATH');
    expect(source).toContain('fs.mkdirSync(path.dirname(outputPath), { recursive: true })');
    expect(source).toContain('process.exitCode = 1');
    expect(source.indexOf('fs.mkdirSync(path.dirname(outputPath)')).toBeLessThan(
      source.indexOf('fs.writeFileSync(outputPath'),
    );
  });

  it('validates the actual replay workload connection string before connecting', () => {
    const source = read('scripts/staging/replay-perf-workload.ts');
    const guardIndex = source.indexOf('assertExactSupabaseProjectRef(connectionString');
    const clientIndex = source.indexOf('new Client({');

    expect(source).toContain(
      'import { assertExactSupabaseProjectRef, DEFAULT_STAGING_PROJECT_REF }',
    );
    expect(source).toContain('const connectionString = buildPgConnectionString();');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(clientIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(clientIndex);
    expect(source).toContain('fs.mkdirSync(artifactsDir, { recursive: true })');
  });

  it('fails production precheck with a non-zero exit after runtime errors', () => {
    const source = read('scripts/production-precheck.ts');

    expect(source).toContain('process.exitCode = 1');
    expect(source.indexOf("console.error('❌ Pre-check failed:'")).toBeLessThan(
      source.indexOf('process.exitCode = 1'),
    );
  });
});
