import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PLAYWRIGHT_CONFIGS = [
  'playwright.config.ts',
  'playwright.app.config.ts',
  'playwright.reserve.config.ts',
] as const;

describe('QA Playwright config guard', () => {
  it('loads the QA environment guard before browser suites can start', () => {
    for (const configPath of PLAYWRIGHT_CONFIGS) {
      const config = readFileSync(configPath, 'utf8');

      expect(config).toContain("import { assertQaEnvironment } from './scripts/qa/environment';");
      expect(config).toContain('assertQaEnvironment();');
    }
  });

  it('refuses production-like targets at Playwright config import time', () => {
    const result = spawnSync(
      'pnpm',
      [
        'exec',
        'tsx',
        '-e',
        "process.env.QA_TARGET_URL = 'https://app.nabatable.com'; process.env.QA_RUN_ID = 'qa-playwright-prod-guard'; import('./playwright.app.config.ts');",
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          QA_TARGET_ENV: 'local',
        },
      },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'Automated QA refused production-like target URL',
    );
  });
});
