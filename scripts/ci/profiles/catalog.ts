import type {
  CiCommand,
  CiImage,
  CiLimits,
  CiRuntime,
  CiSuite,
  ConditionalRule,
  ResourceClass,
} from '../contracts/profile';
import { SHUFFLE_SEEDS, type ShuffleSeed, shuffleSeedCheckName } from '../contracts/names';

/**
 * Single source of truth for the data every profile is assembled from.
 * Profiles (pr/main/nightly) only select from and arrange what is defined here.
 */

export const POLICY_VERSION = '2026-09-04.1';

export const RUNTIME: CiRuntime = {
  activeRuntime: 'node22',
  candidateRuntime: 'node24',
  pnpm: '10.34.5',
  qualificationNote:
    'Hosted workflows pin Node 22; production Vercel runs Node 24. node24 becomes active only after a full nightly profile passes on it and package engines/workflow node-version are bumped in the same change.',
};

/** Digests are unknown until the job image is built; placeholders are reported as unconfigured. */
export const IMAGE: CiImage = {
  ubuntuDigest: 'REPLACE_ME_UBUNTU_BASE_IMAGE_DIGEST',
  jobImageDigest: 'REPLACE_ME_CI_JOB_IMAGE_DIGEST',
  playwrightVersion: '1.58.1',
};

export const RESOURCE_LIMITS: Readonly<Record<ResourceClass, Omit<CiLimits, 'timeoutMinutes'>>> = {
  normal: {
    cpu: 6,
    memoryGiB: 16,
    pids: 4096,
    diskGiB: 40,
    vitestWorkers: 4,
    playwrightWorkers: 1,
  },
  dedicated: {
    cpu: 10,
    memoryGiB: 24,
    pids: 8192,
    diskGiB: 60,
    vitestWorkers: 8,
    playwrightWorkers: 1,
  },
};

export function limitsFor(resourceClass: ResourceClass, timeoutMinutes: number): CiLimits {
  return { ...RESOURCE_LIMITS[resourceClass], timeoutMinutes };
}

/** Mirrors the sanitized env used by every hosted workflow, plus CI=true. */
export const SANITIZED_ENV: Readonly<Record<string, string>> = {
  APP_ENV: 'test',
  CI: 'true',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  QA_TARGET_ENV: 'ci-ephemeral',
  RESEND_API_KEY: 'test-resend-api-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  TZ: 'UTC',
};

export const BROWSER_ENV_OVERLAY: Readonly<Record<string, string>> = { QA_USE_MOCKS: '1' };

const command = (
  id: string,
  run: string,
  kind: CiCommand['kind'],
  timeoutMinutes: number,
  env?: Readonly<Record<string, string>>,
): CiCommand => ({ id, run, kind, timeoutMinutes, ...(env ? { env: { ...env } } : {}) });

export const STATIC_COMMANDS: readonly CiCommand[] = [
  command('agents:validate', 'pnpm agents:validate', 'static', 2),
  command('openapi:validate', 'pnpm openapi:validate', 'static', 2),
  command('check:feature-flags', 'pnpm check:feature-flags', 'static', 2),
  command('check:large-files', 'pnpm check:large-files', 'static', 2),
  command('format:check', 'pnpm format:check', 'static', 5),
  command('guard:luma:strict', 'pnpm guard:luma:strict', 'static', 3),
  command('lint', 'pnpm lint', 'static', 10),
  command('lint:workspaces', 'pnpm lint:workspaces', 'static', 5),
  command('typecheck', 'pnpm typecheck', 'static', 10),
  command('typecheck:strict', 'pnpm typecheck:strict', 'static', 10),
  command('typecheck:workspaces', 'pnpm typecheck:workspaces', 'static', 5),
  command('quality:dead-code', 'pnpm quality:dead-code', 'static', 10),
  command('quality:duplicates', 'pnpm quality:duplicates', 'static', 10),
];

export const DB_COMMANDS: readonly CiCommand[] = [
  command(
    'supabase:migration-versions-unique',
    'bash scripts/supabase/check_migration_versions_unique.sh',
    'db',
    2,
  ),
  command('db:check-migration-immutability', 'pnpm db:check-migration-immutability', 'db', 5),
];

export const VITEST_COMMANDS: readonly CiCommand[] = [
  command('test', 'pnpm test', 'vitest', 25),
  command('test:ci', 'pnpm test:ci', 'vitest', 25),
  command('test:ci:workspaces', 'pnpm test:ci:workspaces', 'vitest', 10),
];

export const SMOKE_SPECS = [
  'tests/e2e/guest-booking.spec.ts',
  'tests/e2e/ops-app-host-redirects.spec.ts',
  'tests/e2e/guest-portal-redirects.spec.ts',
] as const;

export function playwrightCommandId(spec: string): string {
  return `playwright:${spec.replace(/^tests\/e2e\//u, '').replace(/\.spec\.ts$/u, '')}`;
}

export function playwrightCommand(spec: string, timeoutMinutes: number): CiCommand {
  return command(
    playwrightCommandId(spec),
    `pnpm exec playwright test ${spec}`,
    'browser',
    timeoutMinutes,
    BROWSER_ENV_OVERLAY,
  );
}

export const SMOKE_COMMANDS: readonly CiCommand[] = SMOKE_SPECS.map((spec) =>
  playwrightCommand(spec, 10),
);

/** Hosted parity: every seed job repeats the Worker suites after the shuffled root run. */
export const STABILITY_WORKSPACES_COMMAND: CiCommand = command(
  'test:workspaces:stability',
  "pnpm --filter '@nabatable/*' -r test",
  'stability',
  10,
);

export function shuffleSeedCommandId(seed: ShuffleSeed): string {
  return `test:stability:${seed}`;
}

export const STABILITY_SEED_COMMANDS: readonly CiCommand[] = SHUFFLE_SEEDS.map((seed) =>
  command(
    shuffleSeedCommandId(seed),
    `pnpm test:stability --sequence.seed=${seed}`,
    'stability',
    25,
  ),
);

export const STABILITY_COMMANDS: readonly CiCommand[] = [
  ...STABILITY_SEED_COMMANDS,
  STABILITY_WORKSPACES_COMMAND,
];

/**
 * Every functional Playwright spec that is not in the smoke pack. Visual
 * route snapshots (ui-visual-routes) stay hosted because the VM image has no
 * pixel-identical browser build.
 */
export const HOSTED_ONLY_SPECS = ['tests/e2e/ui-visual-routes.spec.ts'] as const;

export const NIGHTLY_SPECS = [
  'tests/e2e/booking-wizard-consumers.spec.ts',
  'tests/e2e/booking-wizard-keyboard.spec.ts',
  'tests/e2e/booking-wizard-responsive.spec.ts',
  'tests/e2e/booking-wizard-states.spec.ts',
  'tests/e2e/guest-auth-pages.spec.ts',
  'tests/e2e/guest-booking-instant-sync.spec.ts',
  'tests/e2e/guest-booking-manage.spec.ts',
  'tests/e2e/guest-dev-harnesses.spec.ts',
  'tests/e2e/guest-mocked-api-coverage.spec.ts',
  'tests/e2e/guest-public-marketing.spec.ts',
  'tests/e2e/guest-public-pages.spec.ts',
  'tests/e2e/guest-receipt-pages.spec.ts',
  'tests/e2e/guest-reserve-routes.spec.ts',
  'tests/e2e/onboarding-routes.spec.ts',
  'tests/e2e/ops-authenticated-app-host.spec.ts',
  'tests/e2e/ops-booking-dialog-action-rail.spec.ts',
  'tests/e2e/ops-capacity-tables.spec.ts',
  'tests/e2e/ops-customers-delivery.spec.ts',
  'tests/e2e/ops-dashboard-print.spec.ts',
  'tests/e2e/ops-email-delivery-dev-harness.spec.ts',
  'tests/e2e/ops-gbp-dual-sync.spec.ts',
  'tests/e2e/ops-guests-dev-harness.spec.ts',
  'tests/e2e/ops-layout-system.spec.ts',
  'tests/e2e/ops-mobile-redesign.spec.ts',
  'tests/e2e/ops-new-bookings.spec.ts',
  'tests/e2e/ops-restaurant-settings-command-center.spec.ts',
  'tests/e2e/ops-restaurant-settings-responsive.spec.ts',
  'tests/e2e/ops-review-growth.spec.ts',
  'tests/e2e/ops-settings-team.spec.ts',
  'tests/e2e/ops-sidebar-active-state.spec.ts',
  'tests/e2e/posthog-cookie-privacy.spec.ts',
  'tests/e2e/settings-data-hooks.spec.ts',
  'tests/e2e/settings-perf.spec.ts',
] as const;

export const NIGHTLY_BROWSER_COMMANDS: readonly CiCommand[] = NIGHTLY_SPECS.map((spec) =>
  playwrightCommand(spec, 15),
);

/** p95 budgets and hard limits (minutes). Hard limits mirror the hosted `timeout-minutes`. */
export const SUITE_BUDGETS = {
  'fast-static-gates': { p95: 10, hard: 15 },
  'migration-integrity': { p95: 2, hard: 10 },
  'full-vitest-suite': { p95: 10, hard: 30 },
  'coverage-and-performance-evidence': { p95: 15, hard: 30 },
  'browser-smoke-packs': { p95: 12, hard: 30 },
  'shuffle-seed': { p95: 12, hard: 30 },
  'nightly-browser-functional': { p95: 90, hard: 150 },
} as const;

const suite = (
  id: string,
  displayName: string,
  kind: CiSuite['kind'],
  commandIds: readonly string[],
  satisfies: CiSuite['satisfies'],
  budget: { readonly p95: number; readonly hard: number },
  resourceClass: ResourceClass,
  conditional = false,
): CiSuite => ({
  id,
  displayName,
  kind,
  commandIds: [...commandIds],
  satisfies: [...satisfies],
  p95BudgetMinutes: budget.p95,
  hardLimitMinutes: budget.hard,
  resourceClass,
  conditional,
});

export function fastStaticGatesSuite(resourceClass: ResourceClass): CiSuite {
  return suite(
    'fast-static-gates',
    'Fast static gates',
    'static',
    STATIC_COMMANDS.map((entry) => entry.id),
    // `pnpm lint` runs guard:no-shadcn:ci and guard:no-shadow-roots, the Primitive coverage job.
    ['Fast static gates', 'Primitive coverage'],
    SUITE_BUDGETS['fast-static-gates'],
    resourceClass,
  );
}

export function migrationIntegritySuite(resourceClass: ResourceClass): CiSuite {
  return suite(
    'migration-integrity',
    'Migration integrity',
    'db',
    DB_COMMANDS.map((entry) => entry.id),
    [],
    SUITE_BUDGETS['migration-integrity'],
    resourceClass,
  );
}

export function fullVitestSuite(resourceClass: ResourceClass): CiSuite {
  return suite(
    'full-vitest-suite',
    'Full Vitest suite',
    'vitest',
    ['test'],
    ['Full Vitest suite'],
    SUITE_BUDGETS['full-vitest-suite'],
    resourceClass,
  );
}

export function coverageEvidenceSuite(resourceClass: ResourceClass): CiSuite {
  return suite(
    'coverage-and-performance-evidence',
    'Coverage and performance evidence',
    'vitest',
    ['test:ci', 'test:ci:workspaces'],
    ['Coverage and performance evidence'],
    SUITE_BUDGETS['coverage-and-performance-evidence'],
    resourceClass,
  );
}

export function browserSmokeSuite(resourceClass: ResourceClass): CiSuite {
  return suite(
    'browser-smoke-packs',
    'Browser smoke packs',
    'browser',
    SMOKE_COMMANDS.map((entry) => entry.id),
    ['Browser smoke packs'],
    SUITE_BUDGETS['browser-smoke-packs'],
    resourceClass,
  );
}

export function shuffleSeedSuiteId(seed: ShuffleSeed): string {
  return `shuffle-seed-${seed}`;
}

export function shuffleSeedSuites(resourceClass: ResourceClass, conditional: boolean): CiSuite[] {
  return SHUFFLE_SEEDS.map((seed) =>
    suite(
      shuffleSeedSuiteId(seed),
      shuffleSeedCheckName(seed),
      'stability',
      [shuffleSeedCommandId(seed), STABILITY_WORKSPACES_COMMAND.id],
      [shuffleSeedCheckName(seed)],
      SUITE_BUDGETS['shuffle-seed'],
      resourceClass,
      conditional,
    ),
  );
}

export function nightlyBrowserSuite(resourceClass: ResourceClass): CiSuite {
  return suite(
    'nightly-browser-functional',
    'Nightly browser functional packs',
    'browser',
    NIGHTLY_BROWSER_COMMANDS.map((entry) => entry.id),
    [],
    SUITE_BUDGETS['nightly-browser-functional'],
    resourceClass,
  );
}

/** Same predicate as `.github/workflows/test-stability.yml` `pull_request.paths`. */
export const TEST_STABILITY_PATH_PATTERNS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  'vitest.config.ts',
  'cloudflare/*/vitest.config.ts',
] as const;

export const TEST_STABILITY_RULE: ConditionalRule = {
  id: 'test-stability-paths',
  description:
    'Shuffle-seed stability runs only when the PR changes test files or a vitest config (mirrors test-stability.yml). Unknown change sets run the suites.',
  suiteIds: SHUFFLE_SEEDS.map(shuffleSeedSuiteId),
  predicate: { type: 'any-changed-path-matches', patterns: [...TEST_STABILITY_PATH_PATTERNS] },
  whenMatch: 'run',
  whenNoMatch: 'skip',
  whenUnknown: 'run',
};
