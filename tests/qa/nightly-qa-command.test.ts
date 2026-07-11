import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const WORKFLOW_PATH = '.github/workflows/nightly-qa.yml';

// MS-foundation-nightly-rc: the release-candidate pack must run nightly on
// main in its safe local/mock mode so drift is caught within a day even when
// nobody opens a PR. These assertions fail if the schedule, the qa:rc
// invocation, the browser install, or the artifact upload is removed or
// weakened.
describe('QA nightly RC command', () => {
  it('schedules the nightly run off-peak and keeps on-demand dispatch @contract @local-only', () => {
    expect(existsSync(WORKFLOW_PATH)).toBe(true);

    const workflow = readFileSync(WORKFLOW_PATH, 'utf8');

    // 03:17 UTC daily — odd minute per GitHub's guidance to avoid the
    // top-of-hour thundering herd.
    expect(workflow).toMatch(/schedule:\s*\n(?:\s*#[^\n]*\n)*\s*- cron: '17 3 \* \* \*'/);
    expect(workflow).toContain('workflow_dispatch');
  });

  it('runs the RC pack with browsers installed and a bounded runtime @contract @local-only', () => {
    const workflow = readFileSync(WORKFLOW_PATH, 'utf8');

    // Bare `pnpm run qa:rc` defers to scripts/qa/rc-pack.ts, which selects
    // every RC phase. Any --phase or --dry-run argument would silently
    // narrow the nightly signal.
    expect(workflow).toMatch(/run:\s*pnpm run qa:rc\s*$/m);
    // The RC pack includes browser phases; chromium must be present.
    expect(workflow).toContain('pnpm exec playwright install chromium --with-deps');
    expect(workflow).toMatch(/timeout-minutes:\s*90\b/);
  });

  it('uploads the RC ledger on success and on failure @contract @local-only', () => {
    const workflow = readFileSync(WORKFLOW_PATH, 'utf8');

    // The persisted rc-summary.json + browser artifacts are the point of the
    // nightly, so a red run must still upload them.
    expect(workflow).toContain('actions/upload-artifact');
    expect(workflow).toMatch(/if:\s*always\(\)/);
    expect(workflow).toMatch(/path:\s*test-results\/qa\b/);
    expect(workflow).toMatch(/retention-days:\s*\d+/);
  });

  it('exports only sanitized offline env and no escape hatches @contract @local-only', () => {
    const workflow = readFileSync(WORKFLOW_PATH, 'utf8');

    // Mirrors test-suite.yml. The workflow must never receive real secrets;
    // rc-pack.ts layers its own safe QA defaults (mock/dry-run, refuses
    // prod-like targets) on top of these values.
    expect(workflow).toContain('APP_ENV: test');
    expect(workflow).toContain('QA_TARGET_ENV: ci-ephemeral');
    expect(workflow).toContain('NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co');
    expect(workflow).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY: test-anon-key');
    expect(workflow).toContain('SUPABASE_SERVICE_ROLE_KEY: test-service-role-key');
    expect(workflow).toContain('RESEND_API_KEY: test-resend-api-key');
    expect(workflow).toContain('TZ: UTC');
    // A masked nightly is worse than a red nightly.
    expect(workflow).not.toContain('continue-on-error');
  });
});
