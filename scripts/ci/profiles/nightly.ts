import { CI_PROFILE_SCHEMA_VERSION, type CiProfile } from '../contracts/profile';
import {
  DB_COMMANDS,
  IMAGE,
  NIGHTLY_BROWSER_COMMANDS,
  POLICY_VERSION,
  RUNTIME,
  SANITIZED_ENV,
  SMOKE_COMMANDS,
  STABILITY_COMMANDS,
  STATIC_COMMANDS,
  VITEST_COMMANDS,
  browserSmokeSuite,
  coverageEvidenceSuite,
  fastStaticGatesSuite,
  fullVitestSuite,
  limitsFor,
  migrationIntegritySuite,
  nightlyBrowserSuite,
  shuffleSeedSuites,
} from './catalog';
import { defineProfile } from './define';

export const NIGHTLY_TIMEOUT_MINUTES = 240;

/** Nightly profile: main plus every remaining functional browser spec, on dedicated limits. */
export const nightlyProfile: CiProfile = defineProfile({
  version: CI_PROFILE_SCHEMA_VERSION,
  name: 'nightly',
  policyVersion: POLICY_VERSION,
  commands: [
    ...STATIC_COMMANDS,
    ...DB_COMMANDS,
    ...VITEST_COMMANDS,
    ...SMOKE_COMMANDS,
    ...STABILITY_COMMANDS,
    ...NIGHTLY_BROWSER_COMMANDS,
  ],
  suites: [
    fastStaticGatesSuite('dedicated'),
    migrationIntegritySuite('dedicated'),
    fullVitestSuite('dedicated'),
    coverageEvidenceSuite('dedicated'),
    browserSmokeSuite('dedicated'),
    ...shuffleSeedSuites('dedicated', false),
    nightlyBrowserSuite('dedicated'),
  ],
  conditionalRules: [],
  runtime: RUNTIME,
  image: IMAGE,
  limits: limitsFor('dedicated', NIGHTLY_TIMEOUT_MINUTES),
  env: { ...SANITIZED_ENV },
});
