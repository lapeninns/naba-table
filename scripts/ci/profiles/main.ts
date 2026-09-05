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

export const MAIN_TIMEOUT_MINUTES = 120;

/** Main profile: the PR profile with every suite unconditional, including all shuffle seeds. */
export const mainProfile: CiProfile = defineProfile({
  version: CI_PROFILE_SCHEMA_VERSION,
  name: 'main',
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
    ...shuffleSeedSuites('normal', false),
  ],
  conditionalRules: [],
  runtime: RUNTIME,
  image: IMAGE,
  limits: limitsFor('normal', MAIN_TIMEOUT_MINUTES),
  env: { ...SANITIZED_ENV },
});
