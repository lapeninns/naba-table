import { describe, expect, it, vi } from 'vitest';

import { selectPrBaselineCommands, type QaCommand } from '@/scripts/qa/changed-path-selector';
import { classifyQaCommandFailure, runPrBaseline } from '@/scripts/qa/pr-baseline';

/**
 * Behavioral pins for scripts/qa/pr-baseline.ts (MS-foundation-qa-harness-self-tests):
 * the failure-classification mapping and the no-execution --list mode. Commands are pulled
 * from the real selector so the default failure classes stay the shipped ones.
 */

function selectedCommand(id: string): QaCommand {
  const selection = selectPrBaselineCommands(['src/app/(public)/reserve/page.tsx']);
  const command = selection.commands.find((entry) => entry.id === id);
  if (!command) {
    throw new Error(`Expected PR baseline selection to include "${id}".`);
  }
  return command;
}

const PLAYWRIGHT_MISSING_BROWSER_OUTPUT = [
  "browserType.launch: Executable doesn't exist at /Users/qa/Library/Caches/ms-playwright/chromium-1187/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
  '╔═════════════════════════════════════════════════════════════════════════╗',
  '║ Looks like Playwright Test or Playwright was just installed or updated. ║',
  '║ Please run the following command to download new browsers:              ║',
  '║                                                                         ║',
  '║     pnpm exec playwright install                                        ║',
  '╚═════════════════════════════════════════════════════════════════════════╝',
].join('\n');

describe('classifyQaCommandFailure', () => {
  it('classifies environment guard failures as missing-setup @contract @local-only', () => {
    const build = selectedCommand('baseline:build');

    expect(
      classifyQaCommandFailure(build, 'Environment validation failed: NEXT_PUBLIC_SUPABASE_URL'),
    ).toBe('missing-setup');
    expect(
      classifyQaCommandFailure(build, 'Environment safety checks failed for qa:public-booking'),
    ).toBe('missing-setup');
    expect(
      classifyQaCommandFailure(build, 'Missing required QA credential env var(s): RESEND_API_KEY'),
    ).toBe('missing-setup');
  });

  it('classifies tooling absence markers as missing-setup @contract @local-only', () => {
    const build = selectedCommand('baseline:build');
    const markers = [
      'sh: 1: playwright: command not found',
      "Error: Cannot find module 'tsx'",
      'node:internal/modules ERR_MODULE_NOT_FOUND',
      'spawn pnpm ENOENT',
      'corepack: command failed',
      'sh: pnpm: not found',
    ];

    for (const marker of markers) {
      expect(classifyQaCommandFailure(build, marker)).toBe('missing-setup');
    }
  });

  it('matches setup markers case-insensitively @contract @local-only', () => {
    expect(
      classifyQaCommandFailure(selectedCommand('baseline:build'), 'ENVIRONMENT VALIDATION FAILED'),
    ).toBe('missing-setup');
  });

  it('KNOWN-ISSUE: classifies a missing Playwright browser as product, not missing-setup @contract @local-only', () => {
    // KNOWN-ISSUE(scripts/qa/pr-baseline.ts): the missing-setup regex has no pattern for
    // Playwright's "Executable doesn't exist" / "playwright install" banner, so an absent
    // browser binary reads as a product failure on browser-smoke commands. Expected class:
    // missing-setup. Do not flip this assertion without fixing the classifier in a
    // product-fix spec (the harness script is out of scope here).
    const browserSmoke = selectedCommand('browser:guest-public-smoke');

    expect(browserSmoke.defaultFailureClass).toBe('product');
    expect(classifyQaCommandFailure(browserSmoke, PLAYWRIGHT_MISSING_BROWSER_OUTPUT)).toBe(
      'product',
    );
  });

  it('KNOWN-ISSUE: classifies missing host browser dependencies as product @contract @local-only', () => {
    // KNOWN-ISSUE(scripts/qa/pr-baseline.ts): same classifier gap as above for the Linux
    // variant of the missing-browser failure. Expected class: missing-setup.
    const browserSmoke = selectedCommand('browser:guest-public-smoke');
    const output = [
      'browserType.launch: Host system is missing dependencies to run browsers.',
      'Please install them with the following command:',
      '    pnpm exec playwright install-deps',
    ].join('\n');

    expect(classifyQaCommandFailure(browserSmoke, output)).toBe('product');
  });

  it('classifies Playwright failures as missing-setup only via generic markers like ENOENT @contract @local-only', () => {
    const browserSmoke = selectedCommand('browser:guest-public-smoke');
    const output = [
      PLAYWRIGHT_MISSING_BROWSER_OUTPUT,
      'spawn /Users/qa/Library/Caches/ms-playwright/chromium-1187/chrome-mac/Chromium ENOENT',
    ].join('\n');

    expect(classifyQaCommandFailure(browserSmoke, output)).toBe('missing-setup');
  });

  it('reclassifies strict-guard debt output as baseline-debt @contract @local-only', () => {
    const build = selectedCommand('baseline:build');

    expect(
      classifyQaCommandFailure(
        build,
        'Failed strict mode: 7 remaining non-color shadcn migration finding(s).',
      ),
    ).toBe('baseline-debt');
    expect(
      classifyQaCommandFailure(build, 'Luma compliance findings remain in components/ops.'),
    ).toBe('baseline-debt');
  });

  it('falls back to the command default failure class for unrecognized output @contract @local-only', () => {
    expect(
      classifyQaCommandFailure(
        selectedCommand('baseline:build'),
        'Type error: Property "slug" is missing in type Restaurant',
      ),
    ).toBe('product');
    expect(
      classifyQaCommandFailure(selectedCommand('ui:shadcn-guard'), 'some unexpected guard crash'),
    ).toBe('baseline-debt');
  });

  it('prefers missing-setup when setup and debt markers both appear @contract @local-only', () => {
    const output = [
      "Error: Cannot find module 'stylelint'",
      'Luma compliance findings remain',
    ].join('\n');

    expect(classifyQaCommandFailure(selectedCommand('ui:shadcn-guard'), output)).toBe(
      'missing-setup',
    );
  });
});

describe('runPrBaseline', () => {
  it('lists selected checks without executing them in --list mode @contract @local-only', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(runPrBaseline(['--changed-files', 'docs/a.md,docs/b.md', '--list'])).toBe(0);

    const output = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(output).toContain('changed files: 2');
    expect(output).toContain('docs/a.md');
    expect(output).toContain('docs/b.md');
    expect(output).toContain('changed:prettier');
    expect(output).toContain('baseline:typecheck');
  });

  it('accepts repeated --changed-file flags @contract @local-only', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(
      runPrBaseline(['--changed-file', 'docs/a.md', '--changed-file', 'docs/b.md', '--list']),
    ).toBe(0);

    const output = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(output).toContain('changed files: 2');
  });

  it('rejects unknown options @contract @local-only', () => {
    expect(() => runPrBaseline(['--wat'])).toThrow('Unknown qa:pr-baseline option "--wat"');
  });
});
