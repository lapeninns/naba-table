import { CI_PROFILE_SCHEMA_VERSION, type CiProfile } from '../contracts/profile';
import {
  DB_COMMANDS,
  IMAGE,
  POLICY_VERSION,
  RUNTIME,
  SANITIZED_ENV,
  SMOKE_COMMANDS,
  STABILITY_COMMANDS,
  STATIC_COMMANDS,
  TEST_STABILITY_RULE,
  VITEST_COMMANDS,
  browserSmokeSuite,
  coverageEvidenceSuite,
  fastStaticGatesSuite,
  fullVitestSuite,
  limitsFor,
  migrationIntegritySuite,
  shuffleSeedSuites,
} from './catalog';
import { defineProfile } from './define';

export const PR_TIMEOUT_MINUTES = 90;

/** Pull-request profile: everything required, stability seeds only when tests change. */
export const prProfile: CiProfile = defineProfile({
  version: CI_PROFILE_SCHEMA_VERSION,
  name: 'pr',
  policyVersion: POLICY_VERSION,
  commands: [
    ...STATIC_COMMANDS,
    ...DB_COMMANDS,
    ...VITEST_COMMANDS,
    ...SMOKE_COMMANDS,
    ...STABILITY_COMMANDS,
  ],
  suites: [
    fastStaticGatesSuite('normal'),
    migrationIntegritySuite('normal'),
    fullVitestSuite('normal'),
    coverageEvidenceSuite('normal'),
    browserSmokeSuite('normal'),
    ...shuffleSeedSuites('normal', true),
  ],
  conditionalRules: [TEST_STABILITY_RULE],
  runtime: RUNTIME,
  image: IMAGE,
  limits: limitsFor('normal', PR_TIMEOUT_MINUTES),
  env: { ...SANITIZED_ENV },
});
