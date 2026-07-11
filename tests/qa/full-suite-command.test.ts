import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const WORKFLOW_PATH = '.github/workflows/test-suite.yml';

// MS-foundation-full-suite-ci-gate: the complete Vitest suite must gate every
// pull request and every push to main. These assertions fail if the entrypoint
// or the workflow wiring is removed or weakened.
describe('QA full-suite command', () => {
  it('defines a package test script that runs the complete non-e2e suite @contract @local-only', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    // Bare `vitest run` defers to vitest.config.ts (include tests/**, exclude
    // tests/e2e/**). Any path argument would silently narrow the gate.
    expect(packageJson.scripts?.test).toBe('vitest run');
  });

  it('wires the full suite into CI on pull requests and pushes to main @contract @local-only', () => {
    expect(existsSync(WORKFLOW_PATH)).toBe(true);

    const workflow = readFileSync(WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain('pull_request');
    expect(workflow).toMatch(/push:\s*\n\s*branches:\s*\n\s*- main/);
    expect(workflow).toContain('workflow_dispatch');
    expect(workflow).toMatch(/run:\s*pnpm test\b/);
  });

  it('runs the suite with sanitized offline env and no escape hatches @contract @local-only', () => {
    const workflow = readFileSync(WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain('APP_ENV: test');
    expect(workflow).toContain('QA_TARGET_ENV: ci-ephemeral');
    expect(workflow).toContain('NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co');
    expect(workflow).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY: test-anon-key');
    expect(workflow).toContain('SUPABASE_SERVICE_ROLE_KEY: test-service-role-key');
    expect(workflow).toContain('RESEND_API_KEY: test-resend-api-key');
    expect(workflow).toContain('TZ: UTC');
    expect(workflow).not.toContain('continue-on-error');
  });
});
