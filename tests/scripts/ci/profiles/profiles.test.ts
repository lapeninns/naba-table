import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { COMPATIBILITY_CHECK_NAMES, SHUFFLE_SEEDS } from '@/scripts/ci/contracts/names';
import { PROFILE_NAMES } from '@/scripts/ci/contracts/primitives';
import { isImageConfigured } from '@/scripts/ci/contracts/profile';
import {
  HOSTED_ONLY_SPECS,
  NIGHTLY_SPECS,
  POLICY_VERSION,
  RESOURCE_LIMITS,
  SMOKE_SPECS,
  TEST_STABILITY_PATH_PATTERNS,
} from '@/scripts/ci/profiles/catalog';
import { mainProfile } from '@/scripts/ci/profiles/main';
import { nightlyProfile } from '@/scripts/ci/profiles/nightly';
import { prProfile } from '@/scripts/ci/profiles/pr';
import { PROFILES, getProfile, isProfileName } from '@/scripts/ci/profiles/registry';

const projectRoot = path.resolve(import.meta.dirname, '../../../..');

const STATIC_RUNS = [
  'pnpm agents:validate',
  'pnpm openapi:validate',
  'pnpm check:feature-flags',
  'pnpm check:large-files',
  'pnpm format:check',
  'pnpm guard:luma:strict',
  'pnpm lint',
  'pnpm lint:workspaces',
  'pnpm typecheck',
  'pnpm typecheck:strict',
  'pnpm typecheck:workspaces',
  'pnpm quality:dead-code',
  'pnpm quality:duplicates',
];

const DB_RUNS = [
  'bash scripts/supabase/check_migration_versions_unique.sh',
  'pnpm db:check-migration-immutability',
];

const VITEST_RUNS = ['pnpm test', 'pnpm test:ci', 'pnpm test:ci:workspaces'];

const SMOKE_RUNS = [
  'pnpm exec playwright test tests/e2e/guest-booking.spec.ts',
  'pnpm exec playwright test tests/e2e/ops-app-host-redirects.spec.ts',
  'pnpm exec playwright test tests/e2e/guest-portal-redirects.spec.ts',
];

const STABILITY_RUNS = [
  'pnpm test:stability --sequence.seed=20260715',
  'pnpm test:stability --sequence.seed=20260716',
  'pnpm test:stability --sequence.seed=20260717',
  "pnpm --filter '@nabatable/*' -r test",
];

const NIGHTLY_BROWSER_RUNS = NIGHTLY_SPECS.map((spec) => `pnpm exec playwright test ${spec}`);

const runsOf = (profile: typeof prProfile): string[] =>
  profile.commands.map((command) => command.run);

describe('profile inventories', () => {
  it('pr runs exactly the agreed commands in order', () => {
    expect(runsOf(prProfile)).toEqual([
      ...STATIC_RUNS,
      ...DB_RUNS,
      ...VITEST_RUNS,
      ...SMOKE_RUNS,
      ...STABILITY_RUNS,
    ]);
  });

  it('main is the pr inventory with every suite unconditional', () => {
    expect(runsOf(mainProfile)).toEqual(runsOf(prProfile));
    expect(mainProfile.conditionalRules).toEqual([]);
    expect(mainProfile.suites.every((suite) => !suite.conditional)).toBe(true);
    expect(mainProfile.suites.map((suite) => suite.id)).toEqual(
      prProfile.suites.map((suite) => suite.id),
    );
  });

  it('nightly is main plus every remaining functional browser spec', () => {
    expect(runsOf(nightlyProfile)).toEqual([...runsOf(mainProfile), ...NIGHTLY_BROWSER_RUNS]);
    expect(nightlyProfile.conditionalRules).toEqual([]);
    expect(nightlyProfile.suites.map((suite) => suite.id)).toEqual([
      ...mainProfile.suites.map((suite) => suite.id),
      'nightly-browser-functional',
    ]);
  });

  it('nightly spec list matches tests/e2e on disk minus smoke and hosted-only specs', () => {
    const onDisk = readdirSync(path.join(projectRoot, 'tests/e2e'))
      .filter((file) => file.endsWith('.spec.ts'))
      .map((file) => `tests/e2e/${file}`)
      .sort();
    const expected = onDisk.filter(
      (spec) =>
        !(SMOKE_SPECS as readonly string[]).includes(spec) &&
        !(HOSTED_ONLY_SPECS as readonly string[]).includes(spec),
    );
    expect([...NIGHTLY_SPECS]).toEqual(expected);
    expect(HOSTED_ONLY_SPECS).toEqual(['tests/e2e/ui-visual-routes.spec.ts']);
    expect(onDisk).toEqual(expect.arrayContaining([...SMOKE_SPECS, ...HOSTED_ONLY_SPECS]));
  });

  it('runs each browser spec as its own invocation with QA_USE_MOCKS=1', () => {
    for (const profile of Object.values(PROFILES)) {
      const browser = profile.commands.filter((command) => command.kind === 'browser');
      expect(browser.length).toBeGreaterThanOrEqual(SMOKE_SPECS.length);
      for (const command of browser) {
        expect(command.run).toMatch(
          /^pnpm exec playwright test tests\/e2e\/[a-z0-9-]+\.spec\.ts$/u,
        );
        expect(command.env).toEqual({ QA_USE_MOCKS: '1' });
      }
      const nonBrowser = profile.commands.filter((command) => command.kind !== 'browser');
      expect(nonBrowser.every((command) => command.env === undefined)).toBe(true);
    }
  });

  it('pr shuffle-seed suites are conditional on the test-stability path predicate', () => {
    const seedSuites = prProfile.suites.filter((suite) => suite.id.startsWith('shuffle-seed-'));
    expect(seedSuites.map((suite) => suite.displayName)).toEqual(
      SHUFFLE_SEEDS.map((seed) => `Shuffle seed ${seed}`),
    );
    expect(seedSuites.every((suite) => suite.conditional)).toBe(true);
    for (const suite of seedSuites) {
      expect(suite.commandIds).toEqual([
        `test:stability:${suite.id.replace('shuffle-seed-', '')}`,
        'test:workspaces:stability',
      ]);
    }
    expect(prProfile.conditionalRules).toHaveLength(1);
    expect(prProfile.conditionalRules[0]).toMatchObject({
      id: 'test-stability-paths',
      suiteIds: seedSuites.map((suite) => suite.id),
      predicate: {
        type: 'any-changed-path-matches',
        patterns: [
          '**/*.test.ts',
          '**/*.test.tsx',
          'vitest.config.ts',
          'cloudflare/*/vitest.config.ts',
        ],
      },
      whenUnknown: 'run',
      whenNoMatch: 'skip',
      whenMatch: 'run',
    });
    expect([...TEST_STABILITY_PATH_PATTERNS]).toEqual(
      prProfile.conditionalRules[0]?.predicate.patterns,
    );
    const everythingElse = prProfile.suites.filter(
      (suite) => !suite.id.startsWith('shuffle-seed-'),
    );
    expect(everythingElse.every((suite) => !suite.conditional)).toBe(true);
  });
});

describe('profile metadata', () => {
  it.each(PROFILE_NAMES)('%s carries the shared policy, runtime, image and env', (name) => {
    const profile = getProfile(name);
    expect(profile.name).toBe(name);
    expect(profile.version).toBe(1);
    expect(profile.policyVersion).toBe(POLICY_VERSION);
    expect(profile.runtime).toMatchObject({
      activeRuntime: 'node22',
      candidateRuntime: 'node24',
      pnpm: '10.34.5',
    });
    expect(profile.runtime.qualificationNote).toMatch(/node24/u);
    expect(profile.image.playwrightVersion).toBe('1.58.1');
    expect(isImageConfigured(profile.image)).toBe(false);
    expect(profile.image.ubuntuDigest).toMatch(/^REPLACE_ME_/u);
    expect(profile.image.jobImageDigest).toMatch(/^REPLACE_ME_/u);
    expect(profile.env).toEqual({
      APP_ENV: 'test',
      CI: 'true',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      QA_TARGET_ENV: 'ci-ephemeral',
      RESEND_API_KEY: 'test-resend-api-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      TZ: 'UTC',
    });
    expect(Object.isFrozen(profile)).toBe(true);
  });

  it('applies the agreed resource limits', () => {
    expect(RESOURCE_LIMITS.normal).toMatchObject({
      cpu: 6,
      memoryGiB: 16,
      vitestWorkers: 4,
      playwrightWorkers: 1,
    });
    expect(RESOURCE_LIMITS.dedicated).toMatchObject({
      cpu: 10,
      memoryGiB: 24,
      vitestWorkers: 8,
      playwrightWorkers: 1,
    });
    expect(prProfile.limits).toEqual({ ...RESOURCE_LIMITS.normal, timeoutMinutes: 90 });
    expect(mainProfile.limits).toEqual({ ...RESOURCE_LIMITS.normal, timeoutMinutes: 120 });
    expect(nightlyProfile.limits).toEqual({ ...RESOURCE_LIMITS.dedicated, timeoutMinutes: 240 });
    expect(nightlyProfile.suites.every((suite) => suite.resourceClass === 'dedicated')).toBe(true);
    expect(prProfile.suites.every((suite) => suite.resourceClass === 'normal')).toBe(true);
  });

  it('keeps p95 budgets under hard limits and hard limits under the profile timeout', () => {
    for (const profile of Object.values(PROFILES)) {
      for (const suite of profile.suites) {
        expect(suite.p95BudgetMinutes).toBeLessThanOrEqual(suite.hardLimitMinutes);
        expect(suite.hardLimitMinutes).toBeLessThanOrEqual(profile.limits.timeoutMinutes);
      }
    }
    const byId = Object.fromEntries(mainProfile.suites.map((suite) => [suite.id, suite]));
    expect(byId['fast-static-gates']).toMatchObject({ p95BudgetMinutes: 10, hardLimitMinutes: 15 });
    expect(byId['full-vitest-suite']).toMatchObject({ p95BudgetMinutes: 10, hardLimitMinutes: 30 });
    expect(byId['browser-smoke-packs']).toMatchObject({
      p95BudgetMinutes: 12,
      hardLimitMinutes: 30,
    });
    expect(byId['shuffle-seed-20260715']).toMatchObject({
      p95BudgetMinutes: 12,
      hardLimitMinutes: 30,
    });
  });

  it('main covers every hosted compatibility check name', () => {
    const satisfied = new Set(mainProfile.suites.flatMap((suite) => suite.satisfies));
    expect([...satisfied].sort()).toEqual([...COMPATIBILITY_CHECK_NAMES].sort());
    const prSatisfied = new Set(prProfile.suites.flatMap((suite) => suite.satisfies));
    expect([...prSatisfied].sort()).toEqual([...COMPATIBILITY_CHECK_NAMES].sort());
  });

  it('registry only knows the three profiles', () => {
    expect(Object.keys(PROFILES)).toEqual(['pr', 'main', 'nightly']);
    expect(isProfileName('pr')).toBe(true);
    expect(isProfileName('release')).toBe(false);
  });
});
