import fs, { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runGuardedQaCommand } from '@/scripts/qa';

const HIGH_RISK_QA_SCRIPTS: Record<string, readonly string[]> = {
  'qa:background-workers': ['--external-mutation'],
  'qa:capacity-tables:api': ['--destructive'],
  'qa:customers-delivery:api': ['--external-mutation'],
  'qa:gbp-dual-sync:api': ['--external-mutation'],
  'qa:guest-portal:api': ['--destructive'],
  'qa:observability-privacy': ['--external-mutation'],
  'qa:onboarding:api': ['--destructive', '--external-mutation'],
  'qa:ops-lifecycle:api': ['--destructive'],
  'qa:public-booking:api': ['--destructive'],
  'qa:reserve-app:api': ['--destructive'],
  'qa:settings-team:api': ['--destructive', '--external-mutation'],
};

function localQaEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    APP_ENV: 'test',
    NEXT_PUBLIC_APP_URL: 'http://localhost:5180',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:5180',
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    PLAYWRIGHT_BASE_URL: 'http://localhost:5180',
    QA_RUN_ID: 'qa-guarded-command',
    QA_TARGET_ENV: 'local',
    RESERVE_API_BASE_URL: 'http://localhost:5174',
    SUPABASE_DB_URL: 'postgresql://postgres:postgres@localhost:54322/postgres',
    SUPABASE_URL: 'http://localhost:54321',
    ...overrides,
  };
}

function sideEffectCommand(outputPath: string): string[] {
  return [
    process.execPath,
    '-e',
    'require("node:fs").writeFileSync(process.argv[1], "ran")',
    outputPath,
  ];
}

function tempSideEffectPath(): string {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'qa-guarded-command-')),
    'side-effect.txt',
  );
}

describe('guarded QA command runner', () => {
  it('@p0 @security blocks production-like targets before executing child commands', () => {
    const sideEffectPath = tempSideEffectPath();

    expect(() =>
      runGuardedQaCommand(
        ['--', ...sideEffectCommand(sideEffectPath)],
        localQaEnv({
          NEXT_PUBLIC_SITE_URL: 'https://app.nabatable.com',
        }),
      ),
    ).toThrow(/production-like target URL/);

    expect(fs.existsSync(sideEffectPath)).toBe(false);
  });

  it('@p0 @destructive @local-only requires explicit destructive permission before executing child commands', () => {
    const sideEffectPath = tempSideEffectPath();

    expect(() =>
      runGuardedQaCommand(
        ['--destructive', '--', ...sideEffectCommand(sideEffectPath)],
        localQaEnv(),
      ),
    ).toThrow(/QA_ALLOW_DESTRUCTIVE=local/);

    expect(fs.existsSync(sideEffectPath)).toBe(false);
  });

  it('@p0 @dry-run-only @external-mock @security requires dry-run or mock proof before external mutation suites run', () => {
    const sideEffectPath = tempSideEffectPath();

    expect(() =>
      runGuardedQaCommand(
        ['--external-mutation', '--', ...sideEffectCommand(sideEffectPath)],
        localQaEnv(),
      ),
    ).toThrow(/External mutation QA requires/);

    expect(fs.existsSync(sideEffectPath)).toBe(false);
  });

  it('@p0 @destructive @dry-run-only @local-only executes the child command once local destructive and dry-run guards pass', () => {
    const sideEffectPath = tempSideEffectPath();
    const exitCode = runGuardedQaCommand(
      ['--destructive', '--external-mutation', '--', ...sideEffectCommand(sideEffectPath)],
      localQaEnv({
        QA_ALLOW_DESTRUCTIVE: 'local',
        QA_EXTERNAL_MUTATION_MODE: 'dry-run',
      }),
    );

    expect(exitCode).toBe(0);
    expect(fs.readFileSync(sideEffectPath, 'utf8')).toBe('ran');
  });

  it('@p0 @security routes high-risk package QA scripts through the guard runner', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    for (const [scriptName, requiredFlags] of Object.entries(HIGH_RISK_QA_SCRIPTS)) {
      const script = packageJson.scripts?.[scriptName] ?? '';

      expect(script).toContain('tsx scripts/qa/run-guarded-command.ts');
      expect(script).toContain('-- pnpm exec vitest run');
      for (const flag of requiredFlags) {
        expect(script).toContain(flag);
      }
    }
  });
});
