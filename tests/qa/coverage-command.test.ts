import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  buildUpdatedBaseline,
  compareCoverageToBaseline,
  type CoverageBaseline,
} from '@/scripts/qa/coverage-ratchet';

const BASELINE_PATH = 'config/qa/coverage-baseline.json';
const RATCHET_SCRIPT_PATH = 'scripts/qa/coverage-ratchet.ts';
const WORKFLOW_PATH = '.github/workflows/test-suite.yml';

type CoverageScopeFloors = {
  branches?: unknown;
  lines?: unknown;
};

// MS-foundation-coverage-ratchet: coverage is a measured, ratcheted number,
// not a feeling. These assertions fail if the coverage entrypoints, the
// frozen baseline, or the CI wiring are removed or weakened.
describe('QA coverage command', () => {
  it('defines package scripts for the coverage run and the ratchet guard @contract @local-only', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    // Bare `vitest run --coverage` defers to vitest.config.ts, whose coverage
    // block only activates under --coverage, so `pnpm test` stays fast.
    expect(packageJson.scripts?.['test:coverage']).toBe('vitest run --coverage');

    // guard:coverage = produce a fresh json-summary, then compare it against
    // the frozen baseline floors. Any rewrite here silently weakens the gate.
    expect(packageJson.scripts?.['guard:coverage']).toBe(
      'pnpm run test:coverage && tsx scripts/qa/coverage-ratchet.ts --baseline=config/qa/coverage-baseline.json',
    );
  });

  it('keeps the ratchet script beside the other QA guards @contract @local-only', () => {
    expect(existsSync(RATCHET_SCRIPT_PATH)).toBe(true);
  });

  it('freezes a parseable baseline with global and per-directory floors above zero @contract @local-only', () => {
    expect(existsSync(BASELINE_PATH)).toBe(true);

    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as {
      schemaVersion?: unknown;
      scopes?: Record<string, CoverageScopeFloors>;
    };

    expect(baseline.schemaVersion).toBe(1);

    const scopes = baseline.scopes ?? {};
    const scopeNames = Object.keys(scopes);
    expect(scopeNames).toContain('global');
    expect(scopeNames.filter((name) => name !== 'global').length).toBeGreaterThanOrEqual(1);

    for (const [scope, floors] of Object.entries(scopes)) {
      for (const metric of ['lines', 'branches'] as const) {
        const floor = floors[metric];
        expect(typeof floor, `${scope}.${metric} floor must be a number`).toBe('number');
        expect(floor, `${scope}.${metric} floor must be above zero`).toBeGreaterThan(0);
        expect(floor, `${scope}.${metric} floor must be a percentage`).toBeLessThanOrEqual(100);
      }
    }
  });

  it('runs the coverage-guarded suite in the full-suite CI workflow @contract @local-only', () => {
    expect(existsSync(WORKFLOW_PATH)).toBe(true);

    const workflow = readFileSync(WORKFLOW_PATH, 'utf8');

    // The fast `pnpm test` step stays as the first signal (pinned by
    // full-suite-command.test.ts); the ratchet runs in the same job so any
    // coverage drop fails CI.
    expect(workflow).toMatch(/run:\s*pnpm guard:coverage\b/);
  });
});

describe('QA coverage ratchet', () => {
  const frozenBaseline: CoverageBaseline = {
    epsilonPct: 0.2,
    generatedAt: '2026-07-11T00:00:00.000Z',
    schemaVersion: 1,
    scopes: {
      global: { branches: 45, lines: 55 },
      server: { branches: 40, lines: 50 },
    },
  };

  it('fails when a scope drops below its frozen floor @contract @local-only', () => {
    const comparison = compareCoverageToBaseline(
      {
        global: { branches: 45, lines: 54.5 },
        server: { branches: 40, lines: 50 },
      },
      frozenBaseline,
    );

    expect(comparison.passed).toBe(false);
    expect(comparison.failures.join('\n')).toContain(
      'global lines coverage 54.50% fell below the baseline floor 55.00%',
    );
  });

  it('refuses to lower an existing floor when regenerating the baseline @contract @local-only', () => {
    const update = buildUpdatedBaseline(
      {
        // Coverage dropped and (for server) rose relative to the floors: the
        // regenerated floors may only ever move up, never down.
        global: { branches: 30, lines: 40 },
        server: { branches: 60, lines: 70 },
      },
      frozenBaseline,
      0.2,
    );

    expect(update.baseline.scopes.global).toEqual({ branches: 45, lines: 55 });
    expect(update.baseline.scopes.server).toEqual({ branches: 59.8, lines: 69.8 });
    expect(update.raised).toHaveLength(1);
    expect(update.raised[0]).toContain('server');
  });
});
