import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { COMPATIBILITY_CHECK_NAMES } from '@/scripts/ci/contracts/names';
import { POLICY_VERSION } from '@/scripts/ci/profiles/catalog';
import { mainProfile } from '@/scripts/ci/profiles/main';
import { nightlyProfile } from '@/scripts/ci/profiles/nightly';
import {
  compatibilityCheckSuiteMap,
  listProfiles,
  profiles,
  suiteInventory,
} from '@/scripts/ci/profiles/policy-suites';
import { prProfile } from '@/scripts/ci/profiles/pr';
import { PROFILES } from '@/scripts/ci/profiles/registry';

const projectRoot = path.resolve(import.meta.dirname, '../../../..');

interface TrustedCiPolicy {
  readonly policyVersion: string;
  readonly profiles: Record<
    string,
    { readonly requiredSuites: readonly string[]; readonly conditionalSuites: readonly string[] }
  >;
  readonly suiteInventory: Record<string, string>;
  readonly compatibilityChecks: Record<string, string>;
}

function loadTrustedCiPolicy(): TrustedCiPolicy {
  return JSON.parse(
    readFileSync(path.join(projectRoot, 'config/ci/policy.json'), 'utf8'),
  ) as TrustedCiPolicy;
}

const PR_SUITES = [
  'fast-static-gates',
  'migration-integrity',
  'full-vitest-suite',
  'coverage-and-performance-evidence',
  'browser-smoke-packs',
  'shuffle-seed-20260715',
  'shuffle-seed-20260716',
  'shuffle-seed-20260717',
];

describe('policy suite bridge', () => {
  it('exposes the gate-readable profiles view', () => {
    expect(Object.keys(profiles)).toEqual(['pr', 'main', 'nightly']);
    expect(profiles.pr).toEqual({
      name: 'pr',
      policyVersion: POLICY_VERSION,
      suites: PR_SUITES,
      requiredSuites: PR_SUITES.slice(0, 5),
      conditionalSuites: PR_SUITES.slice(5),
    });
    expect(profiles.main).toEqual({
      name: 'main',
      policyVersion: POLICY_VERSION,
      suites: PR_SUITES,
      requiredSuites: PR_SUITES,
      conditionalSuites: [],
    });
    expect(profiles.nightly.suites).toEqual([...PR_SUITES, 'nightly-browser-functional']);
    expect(profiles.nightly.conditionalSuites).toEqual([]);
    expect(Object.isFrozen(profiles)).toBe(true);
    expect(Object.isFrozen(profiles.pr.suites)).toBe(true);
    expect(listProfiles().map((entry) => entry.name)).toEqual(['pr', 'main', 'nightly']);
  });

  it('maps every hosted compatibility check to exactly one suite', () => {
    const map = compatibilityCheckSuiteMap(mainProfile);
    expect(Object.keys(map)).toEqual([...COMPATIBILITY_CHECK_NAMES]);
    expect(map['Primitive coverage']).toBe('fast-static-gates');
    expect(map['Shuffle seed 20260716']).toBe('shuffle-seed-20260716');
    expect(compatibilityCheckSuiteMap(prProfile)).toEqual(map);
    expect(compatibilityCheckSuiteMap(nightlyProfile)).toEqual(map);
    const unsatisfied = {
      ...mainProfile,
      suites: mainProfile.suites.map((suite) =>
        suite.id === 'browser-smoke-packs' ? { ...suite, satisfies: [] } : suite,
      ),
    };
    expect(() => compatibilityCheckSuiteMap(unsatisfied)).toThrow(/Browser smoke packs/u);
    const doubled = {
      ...mainProfile,
      suites: mainProfile.suites.map((suite) =>
        suite.id === 'migration-integrity'
          ? { ...suite, satisfies: ['Browser smoke packs' as const] }
          : suite,
      ),
    };
    expect(() => compatibilityCheckSuiteMap(doubled)).toThrow(/both/u);
  });

  it('keeps config/ci/policy.json in lock-step with the profiles', () => {
    const policy = loadTrustedCiPolicy();
    expect(policy.policyVersion).toBe(POLICY_VERSION);
    expect(policy.compatibilityChecks).toEqual(compatibilityCheckSuiteMap(mainProfile));
    expect(policy.suiteInventory).toEqual(suiteInventory(nightlyProfile));
    expect(Object.keys(policy.profiles).sort()).toEqual(Object.keys(PROFILES).sort());
    for (const [name, inventory] of Object.entries(profiles)) {
      expect(policy.profiles[name]?.requiredSuites).toEqual(inventory.requiredSuites);
      expect(policy.profiles[name]?.conditionalSuites).toEqual(inventory.conditionalSuites);
    }
  });
});
