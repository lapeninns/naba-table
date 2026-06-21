import fs, { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  assertNoPendingCleanupRecords,
  classifyRcQaFailure,
  RC_QA_COMMANDS,
  RC_QUARANTINED_TESTS,
  runRcQa,
  selectRcQaCommands,
} from '@/scripts/qa/rc-pack';

function tempCleanupRegistryPath(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-rc-cleanup-')), 'registry.json');
}

describe('QA release candidate command', () => {
  it('exposes the RC command and suite selectors', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['qa:rc']).toBe('tsx scripts/qa/rc-pack.ts');
    expect(packageJson.scripts?.['qa:rc:list']).toBe('tsx scripts/qa/rc-pack.ts --list');
    expect(packageJson.scripts?.['qa:rc:p0p1-api']).toContain('pnpm run qa:public-booking:api');
    expect(packageJson.scripts?.['qa:rc:p0p1-api']).toContain('pnpm run qa:ops-lifecycle:api');
    expect(packageJson.scripts?.['qa:rc:p0p1-api']).toContain('pnpm run qa:guest-portal:api');
    expect(packageJson.scripts?.['qa:rc:p0p1-api']).toContain('pnpm run qa:capacity-tables:api');
    expect(packageJson.scripts?.['qa:rc:p0p1-api']).toContain('pnpm run qa:settings-team:api');
    expect(packageJson.scripts?.['qa:rc:p0p1-api']).toContain('pnpm run qa:customers-delivery:api');
    expect(packageJson.scripts?.['qa:rc:p0p1-api']).toContain('pnpm run security:regression');
    expect(packageJson.scripts?.['qa:rc:p0p1-api']).toContain(
      'pnpm run security:guard:service-role',
    );
    expect(packageJson.scripts?.['qa:rc:p0p1-browser']).toContain(
      'pnpm run qa:public-booking:browser',
    );
    expect(packageJson.scripts?.['qa:rc:p0p1-browser']).toContain(
      'pnpm run qa:ops-authenticated:browser',
    );
    expect(packageJson.scripts?.['qa:rc:p0p1-browser']).toContain(
      'pnpm run qa:capacity-tables:browser',
    );
    expect(packageJson.scripts?.['qa:rc:p0p1-browser']).toContain(
      'pnpm run qa:settings-team:browser',
    );
    expect(packageJson.scripts?.['qa:rc:p0p1-browser']).toContain(
      'pnpm run qa:customers-delivery:browser',
    );
    expect(packageJson.scripts?.['qa:rc:workers']).toBe('pnpm run qa:background-workers');
    expect(packageJson.scripts?.['qa:rc:a11y-visual']).toBe('pnpm run qa:ui-regression');
    expect(packageJson.scripts?.['qa:rc:artifact-safety']).toContain(
      'tests/qa/cleanup-registry.test.ts',
    );
    expect(packageJson.scripts?.['qa:rc:artifact-safety']).toContain(
      'tests/qa/artifact-sanitizer.test.ts',
    );
    expect(packageJson.scripts?.['qa:artifacts:sanitize']).toBe(
      'tsx scripts/qa/artifact-sanitizer.ts',
    );
    expect(packageJson.scripts?.['secret:scan']).toBe('tsx scripts/qa/secret-scan.ts');
    expect(packageJson.scripts?.['guard:qa-tags']).toBe(
      'tsx scripts/qa/tag-audit.ts --baseline=config/qa/tag-baseline.json',
    );
  });

  it('covers required RC phases without counting quarantined tests as commands', () => {
    expect(RC_QA_COMMANDS.map((command) => command.id)).toEqual([
      'build',
      'reserve_build',
      'lint',
      'typecheck',
      'secret_scan',
      'tag_audit',
      'p0p1_api_security',
      'p0p1_browser',
      'worker_smoke',
      'a11y_visual',
      'observability_privacy',
      'performance',
      'artifact_safety',
    ]);
    expect(RC_QA_COMMANDS.some((command) => command.command.includes('secret:scan'))).toBe(true);
    expect(RC_QA_COMMANDS.some((command) => command.command.includes('guard:qa-tags'))).toBe(true);
    expect(RC_QA_COMMANDS.some((command) => command.command.includes('qa:rc:p0p1-api'))).toBe(true);
    expect(RC_QA_COMMANDS.some((command) => command.command.includes('qa:rc:p0p1-browser'))).toBe(
      true,
    );
    expect(RC_QA_COMMANDS.some((command) => command.command.includes('qa:rc:workers'))).toBe(true);
    expect(RC_QA_COMMANDS.some((command) => command.command.includes('qa:rc:a11y-visual'))).toBe(
      true,
    );
    expect(RC_QUARANTINED_TESTS).toEqual([]);
  });

  it('supports phase selection for expensive local runs', () => {
    expect(selectRcQaCommands(new Set(['worker'])).map((command) => command.id)).toEqual([
      'worker_smoke',
    ]);
  });

  it('classifies missing setup separately from product failures', () => {
    expect(classifyRcQaFailure('gitleaks: command not found')).toBe('missing-setup');
    expect(
      classifyRcQaFailure(
        'Failed strict mode: 10 remaining non-color shadcn migration finding(s).',
      ),
    ).toBe('baseline-debt');
    expect(classifyRcQaFailure('Failed --fail-on=exception: Luma baseline ratchet exceeded.')).toBe(
      'baseline-debt',
    );
    expect(classifyRcQaFailure('expected status 200 received 500')).toBe('product-failure');
  });

  it('fails the RC janitor when persisted cleanup registry records are pending', () => {
    const registryPath = tempCleanupRegistryPath();
    fs.writeFileSync(
      registryPath,
      JSON.stringify(
        {
          records: [{ id: 'booking-1', status: 'pending', type: 'booking' }],
          runId: 'qa-rc-pending',
        },
        null,
        2,
      ),
    );

    expect(() => assertNoPendingCleanupRecords(registryPath)).toThrow(/pending QA record/);

    fs.writeFileSync(
      registryPath,
      JSON.stringify(
        {
          records: [{ id: 'booking-1', status: 'cleaned', type: 'booking' }],
          runId: 'qa-rc-pending',
        },
        null,
        2,
      ),
    );

    expect(() => assertNoPendingCleanupRecords(registryPath)).not.toThrow();
  });

  it('@p0 @observability @security sanitizes the current RC artifact directory before writing the summary', () => {
    const qaRunId = 'qa-rc-sanitizer-unit';
    const artifactRoot = 'test-results/qa-rc-sanitizer-unit';
    const runDir = path.join(artifactRoot, qaRunId);
    const traceDir = path.join(runDir, 'browser/failing-test');
    const logDir = path.join(runDir, 'logs');
    const previousEnv = {
      QA_ARTIFACT_ROOT: process.env.QA_ARTIFACT_ROOT,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL,
      QA_RUN_ID: process.env.QA_RUN_ID,
      QA_TARGET_ENV: process.env.QA_TARGET_ENV,
    };

    fs.rmSync(artifactRoot, { force: true, recursive: true });
    fs.mkdirSync(traceDir, { recursive: true });
    fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(path.join(traceDir, 'trace.zip'), 'cookie-token-email-phone');
    fs.writeFileSync(path.join(logDir, 'run.log'), 'Authorization: Bearer log-secret\n');

    process.env.QA_ARTIFACT_ROOT = artifactRoot;
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:5180';
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:5180';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.PLAYWRIGHT_BASE_URL = 'http://localhost:5180';
    process.env.QA_RUN_ID = qaRunId;
    process.env.QA_TARGET_ENV = 'local';

    try {
      expect(runRcQa(['--dry-run', '--phase', 'static'])).toBe(0);
      expect(fs.existsSync(path.join(traceDir, 'trace.zip'))).toBe(false);
      expect(fs.readFileSync(path.join(traceDir, 'trace.zip.redacted.txt'), 'utf8')).toContain(
        'Playwright trace archive removed',
      );
      expect(fs.readFileSync(path.join(logDir, 'run.log'), 'utf8')).not.toContain('log-secret');

      const summary = JSON.parse(fs.readFileSync(path.join(runDir, 'rc-summary.json'), 'utf8')) as {
        artifacts?: {
          sanitizer?: {
            redacted?: number;
            removed?: number;
          };
        };
      };

      expect(summary.artifacts?.sanitizer?.redacted).toBe(1);
      expect(summary.artifacts?.sanitizer?.removed).toBe(1);
    } finally {
      if (previousEnv.QA_ARTIFACT_ROOT === undefined) {
        delete process.env.QA_ARTIFACT_ROOT;
      } else {
        process.env.QA_ARTIFACT_ROOT = previousEnv.QA_ARTIFACT_ROOT;
      }
      if (previousEnv.QA_RUN_ID === undefined) {
        delete process.env.QA_RUN_ID;
      } else {
        process.env.QA_RUN_ID = previousEnv.QA_RUN_ID;
      }
      if (previousEnv.NEXT_PUBLIC_APP_URL === undefined) {
        delete process.env.NEXT_PUBLIC_APP_URL;
      } else {
        process.env.NEXT_PUBLIC_APP_URL = previousEnv.NEXT_PUBLIC_APP_URL;
      }
      if (previousEnv.NEXT_PUBLIC_SITE_URL === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_URL;
      } else {
        process.env.NEXT_PUBLIC_SITE_URL = previousEnv.NEXT_PUBLIC_SITE_URL;
      }
      if (previousEnv.NEXT_PUBLIC_SUPABASE_URL === undefined) {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      } else {
        process.env.NEXT_PUBLIC_SUPABASE_URL = previousEnv.NEXT_PUBLIC_SUPABASE_URL;
      }
      if (previousEnv.PLAYWRIGHT_BASE_URL === undefined) {
        delete process.env.PLAYWRIGHT_BASE_URL;
      } else {
        process.env.PLAYWRIGHT_BASE_URL = previousEnv.PLAYWRIGHT_BASE_URL;
      }
      if (previousEnv.QA_TARGET_ENV === undefined) {
        delete process.env.QA_TARGET_ENV;
      } else {
        process.env.QA_TARGET_ENV = previousEnv.QA_TARGET_ENV;
      }
      fs.rmSync(artifactRoot, { force: true, recursive: true });
    }
  });
});
