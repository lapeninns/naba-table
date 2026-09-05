import { COMPATIBILITY_CHECK_NAMES, type CompatibilityCheckName } from '../contracts/names';
import type { ProfileName } from '../contracts/primitives';
import type { CiProfile } from '../contracts/profile';
import { PROFILES } from './registry';

/**
 * Bridge between profile data and the trusted CI policy (`config/ci/policy.json`).
 * The gate (`pnpm ci:contracts:validate`) imports the `profiles` view below and
 * refuses when a policy `requiredSuites` entry is not run by the profile. The
 * policy file uses the same suite ids as the profiles; the tests under
 * tests/scripts/ci/profiles keep `suiteInventory`, `compatibilityChecks` and the
 * per-profile suite lists in lock-step with this module.
 */

export interface ProfileSuiteInventory {
  readonly name: ProfileName;
  readonly policyVersion: string;
  /** Every suite the profile can run, in execution order. */
  readonly suites: readonly string[];
  /** Suites always run for this profile (policy `requiredSuites`). */
  readonly requiredSuites: readonly string[];
  /** Suites governed by a conditional rule (policy `conditionalSuites`). */
  readonly conditionalSuites: readonly string[];
}

/**
 * Hosted compatibility check name -> the single suite id that stands in for it.
 * Throws when a check is satisfied by no suite or by more than one, because the
 * gate maps each hosted check to exactly one local suite.
 */
export function compatibilityCheckSuiteMap(
  profile: CiProfile,
): Readonly<Record<CompatibilityCheckName, string>> {
  const map = new Map<CompatibilityCheckName, string>();
  for (const suite of profile.suites) {
    for (const checkName of suite.satisfies) {
      const existing = map.get(checkName);
      if (existing !== undefined && existing !== suite.id) {
        throw new Error(
          `profile ${profile.name}: check "${checkName}" is satisfied by both ${existing} and ${suite.id}`,
        );
      }
      map.set(checkName, suite.id);
    }
  }
  const missing = COMPATIBILITY_CHECK_NAMES.filter((checkName) => !map.has(checkName));
  if (missing.length > 0) {
    throw new Error(
      `profile ${profile.name}: no suite satisfies compatibility check(s) ${missing.join(', ')}`,
    );
  }
  return Object.freeze(
    Object.fromEntries(
      COMPATIBILITY_CHECK_NAMES.map((checkName) => [checkName, map.get(checkName)]),
    ),
  ) as Readonly<Record<CompatibilityCheckName, string>>;
}

/** Suite id -> display name for every suite the profile defines (policy `suiteInventory`). */
export function suiteInventory(profile: CiProfile): Readonly<Record<string, string>> {
  return Object.freeze(
    Object.fromEntries(profile.suites.map((suite) => [suite.id, suite.displayName])),
  );
}

function inventoryOf(profile: CiProfile): ProfileSuiteInventory {
  return Object.freeze({
    name: profile.name,
    policyVersion: profile.policyVersion,
    suites: Object.freeze(profile.suites.map((suite) => suite.id)),
    requiredSuites: Object.freeze(
      profile.suites.filter((suite) => !suite.conditional).map((suite) => suite.id),
    ),
    conditionalSuites: Object.freeze(
      profile.suites.filter((suite) => suite.conditional).map((suite) => suite.id),
    ),
  });
}

/**
 * Suite inventory in the shape `scripts/ci/gate/validate-contracts.ts` reads
 * (`profiles[name].suites` as string ids). Keep the export name stable.
 */
export const profiles: Readonly<Record<ProfileName, ProfileSuiteInventory>> = Object.freeze({
  pr: inventoryOf(PROFILES.pr),
  main: inventoryOf(PROFILES.main),
  nightly: inventoryOf(PROFILES.nightly),
});

export function listProfiles(): readonly ProfileSuiteInventory[] {
  return [profiles.pr, profiles.main, profiles.nightly];
}
