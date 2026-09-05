import { describe, expect, it } from 'vitest';

import { TEST_STABILITY_RULE } from '@/scripts/ci/profiles/catalog';
import {
  evaluateRule,
  globToRegExp,
  matchesAnyPattern,
  resolveProfile,
} from '@/scripts/ci/profiles/conditional';
import { mainProfile } from '@/scripts/ci/profiles/main';
import { prProfile } from '@/scripts/ci/profiles/pr';

const TEST_CHANGING = [
  ['tests/server/bookings.test.ts', true],
  ['tests/components/Shell.test.tsx', true],
  ['cloudflare/email-queue-gateway/src/index.test.ts', true],
  ['vitest.config.ts', true],
  ['cloudflare/booking-short-links/vitest.config.ts', true],
  ['./tests/lib/a.test.ts', true],
  ['root.test.ts', true],
] as const;

const NON_TEST_CHANGING = [
  ['src/app/page.tsx', false],
  ['server/bookings/create.ts', false],
  ['tests/e2e/guest-booking.spec.ts', false],
  ['tests/setup.ts', false],
  ['cloudflare/vitest.config.ts', false],
  ['cloudflare/a/b/vitest.config.ts', false],
  ['docs/testing/vitest.config.ts.md', false],
  ['tests/server/bookings.test.ts.snap', false],
  ['package.json', false],
] as const;

describe('glob matching', () => {
  it.each([...TEST_CHANGING, ...NON_TEST_CHANGING])(
    '%s matches test-stability paths: %s',
    (path, expected) => {
      expect(matchesAnyPattern(path, TEST_STABILITY_RULE.predicate.patterns)).toBe(expected);
    },
  );

  it('keeps single stars inside one segment and escapes regex metacharacters', () => {
    expect(
      globToRegExp('cloudflare/*/vitest.config.ts').test('cloudflare/x/vitest.config.ts'),
    ).toBe(true);
    expect(
      globToRegExp('cloudflare/*/vitest.config.ts').test('cloudflare/x/y/vitest.config.ts'),
    ).toBe(false);
    expect(globToRegExp('vitest.config.ts').test('vitestXconfig.ts')).toBe(false);
    expect(globToRegExp('docs/**').test('docs/a/b.md')).toBe(true);
    expect(globToRegExp('src/**/*.ts').test('src/a.ts')).toBe(true);
    expect(globToRegExp('src/**/*.ts').test('src/a/b/c.ts')).toBe(true);
    expect(globToRegExp('a?c').test('abc')).toBe(true);
    expect(globToRegExp('a?c').test('a/c')).toBe(false);
  });
});

describe('evaluateRule', () => {
  it('runs when changed paths are unknown (fail closed)', () => {
    expect(evaluateRule(TEST_STABILITY_RULE, null)).toEqual({
      ruleId: 'test-stability-paths',
      decision: 'run',
      reason: 'changed-paths-unknown',
    });
  });

  it('runs on the first matching path and skips when nothing matches', () => {
    expect(evaluateRule(TEST_STABILITY_RULE, ['src/a.ts', 'tests/x.test.ts'])).toEqual({
      ruleId: 'test-stability-paths',
      decision: 'run',
      reason: 'matched',
      matchedPath: 'tests/x.test.ts',
    });
    expect(
      evaluateRule(
        TEST_STABILITY_RULE,
        NON_TEST_CHANGING.map(([path]) => path),
      ),
    ).toEqual({
      ruleId: 'test-stability-paths',
      decision: 'skip',
      reason: 'no-match',
    });
    expect(evaluateRule(TEST_STABILITY_RULE, []).decision).toBe('skip');
  });
});

describe('resolveProfile', () => {
  // Suites expand shared commands (the Worker re-run appears once per seed suite, as hosted).
  const expandedRuns = (profile: typeof prProfile): string[] =>
    profile.suites.flatMap((suite) =>
      suite.commandIds.map(
        (id) => profile.commands.find((command) => command.id === id)?.run ?? id,
      ),
    );
  const seedSuiteIds = ['shuffle-seed-20260715', 'shuffle-seed-20260716', 'shuffle-seed-20260717'];

  it('skips the stability seeds for a non-test-changing pr', () => {
    const resolved = resolveProfile(prProfile, ['src/app/page.tsx', 'server/x.ts']);
    expect(resolved.changedPathsProvided).toBe(true);
    const skipped = resolved.suites
      .filter((suite) => !suite.included)
      .map((suite) => suite.suiteId);
    expect(skipped).toEqual(seedSuiteIds);
    expect(resolved.commands.some((command) => command.kind === 'stability')).toBe(false);
    expect(resolved.commands.map((command) => command.run)).toEqual(
      prProfile.commands
        .filter((command) => command.kind !== 'stability')
        .map((command) => command.run),
    );
  });

  it('runs the stability seeds for a test-changing pr and when paths are unknown', () => {
    for (const changed of [['tests/server/a.test.ts'], null]) {
      const resolved = resolveProfile(prProfile, changed);
      expect(resolved.suites.every((suite) => suite.included)).toBe(true);
      expect(resolved.commands.map((command) => command.run)).toEqual(expandedRuns(prProfile));
      const seedSuite = resolved.suites.find((suite) => suite.suiteId === seedSuiteIds[0]);
      expect(seedSuite?.ruleId).toBe('test-stability-paths');
      expect(seedSuite?.reason).toContain(
        changed ? 'matched tests/server/a.test.ts' : 'fail closed',
      );
    }
  });

  it('never skips anything on main regardless of changed paths', () => {
    const resolved = resolveProfile(mainProfile, ['README.md']);
    expect(
      resolved.suites.every((suite) => suite.included && suite.reason === 'unconditional'),
    ).toBe(true);
    expect(resolved.commands.map((command) => command.run)).toEqual(expandedRuns(mainProfile));
  });

  it('merges the command env overlay onto the profile env and reports image status', () => {
    const resolved = resolveProfile(prProfile, null);
    const browser = resolved.commands.find((command) => command.kind === 'browser');
    expect(browser?.effectiveEnv).toEqual({ ...prProfile.env, QA_USE_MOCKS: '1' });
    const staticCommand = resolved.commands.find((command) => command.kind === 'static');
    expect(staticCommand?.effectiveEnv).toEqual(prProfile.env);
    expect(resolved.image.configured).toBe(false);
    expect(resolved.commands.every((command) => command.effectiveEnv.CI === 'true')).toBe(true);
  });
});
