import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SMOKE_WORKFLOW_PATH = '.github/workflows/e2e-smoke.yml';
const PR_BASELINE_WORKFLOW_PATH = '.github/workflows/qa-pr-baseline.yml';
const PLAYWRIGHT_INSTALL_COMMAND = 'pnpm exec playwright install chromium --with-deps';

// MS-foundation-playwright-ci-gate: the three unauthenticated browser smoke
// packs must gate every pull request and every push to main, and any workflow
// that may run Playwright must install the pinned Chromium browser first.
// These assertions fail if the workflow wiring is removed or weakened.
describe('QA e2e smoke command', () => {
  it('wires the smoke workflow into CI on pull requests and pushes to main @contract @local-only', () => {
    expect(existsSync(SMOKE_WORKFLOW_PATH)).toBe(true);

    const workflow = readFileSync(SMOKE_WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain('pull_request');
    expect(workflow).toMatch(/push:\s*\n\s*branches:\s*\n\s*- main/);
    expect(workflow).toContain('workflow_dispatch');
  });

  it('runs the three unauthenticated browser smoke packs @contract @local-only', () => {
    const workflow = readFileSync(SMOKE_WORKFLOW_PATH, 'utf8');

    expect(workflow).toMatch(/run:\s*pnpm run qa:public-booking:browser\b/);
    expect(workflow).toMatch(/run:\s*pnpm run qa:ops-lifecycle:browser\b/);
    expect(workflow).toMatch(/run:\s*pnpm run qa:guest-portal:browser\b/);
  });

  it('installs the pinned Chromium browser before running Playwright @contract @local-only', () => {
    const workflow = readFileSync(SMOKE_WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain(PLAYWRIGHT_INSTALL_COMMAND);
  });

  it('runs the packs with sanitized mock env and no escape hatches @contract @local-only', () => {
    const workflow = readFileSync(SMOKE_WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain('APP_ENV: test');
    expect(workflow).toContain('QA_TARGET_ENV: ci-ephemeral');
    expect(workflow).toContain('NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co');
    expect(workflow).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY: test-anon-key');
    expect(workflow).toContain('SUPABASE_SERVICE_ROLE_KEY: test-service-role-key');
    expect(workflow).toContain('RESEND_API_KEY: test-resend-api-key');
    expect(workflow).toContain("QA_USE_MOCKS: '1'");
    expect(workflow).toContain('TZ: UTC');
    expect(workflow).not.toContain('continue-on-error');
  });

  it('bounds the job and uploads Playwright artifacts on failure only @contract @local-only', () => {
    const workflow = readFileSync(SMOKE_WORKFLOW_PATH, 'utf8');

    expect(workflow).toMatch(/timeout-minutes:\s*\d+/);
    expect(workflow).toContain('actions/upload-artifact');
    expect(workflow).toMatch(/if:\s*failure\(\)/);
  });

  it('installs Chromium in the PR baseline workflow so conditional Playwright selection can execute @contract @local-only', () => {
    const workflow = readFileSync(PR_BASELINE_WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain(PLAYWRIGHT_INSTALL_COMMAND);
  });
});
