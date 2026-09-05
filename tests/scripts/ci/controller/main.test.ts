import { describe, expect, it } from 'vitest';

import {
  CliArgumentError,
  ConfigError,
  DEFAULT_KEYCHAIN_ACCOUNT,
  DEFAULT_KEYCHAIN_GITHUB_APP_KEY,
  DEFAULT_KEYCHAIN_HEARTBEAT_TOKEN,
  ENV,
  HELP,
  decodePrivateKeyMaterial,
  describeConfig,
  imageReferenceDigest,
  loadConfig,
  parseArgs,
} from '@/scripts/ci/controller/main';
import { POLICY_VERSION } from '@/scripts/ci/profiles/catalog';

import { APP_ID, INSTALLATION_ID, REPO_ID, trustPolicy } from './helpers';
import { DIGEST_1, DIGEST_2 } from '../contracts/fixtures';

import type { OperatingConfig, TrustPolicy } from '@/scripts/ci/contracts';

const operating: OperatingConfig = {
  version: 1,
  timezone: 'Europe/London',
  dedicatedWindow: { start: '00:30', end: '06:30' },
  nightlyStart: '00:45',
  disk: { minFreeGiB: 100, ciCapGiB: 120 },
  retention: { logs: { days: 7, maxGiB: 10 }, evidence: { days: 14 } },
  polling: { intervalSeconds: 30, jitterSeconds: 10 },
  heartbeat: { alertAfterMinutes: 15 },
  fallback: { eligibilityAfterMinutes: 60 },
};

const KEY_PATH = '/Users/nabatable-ci/nabatable-ci/run/github-app.pem';

/** The controller.env + controller.sh contract (infra/local-ci). */
const fullEnv: Record<string, string> = {
  NABATABLE_CI_GITHUB_APP_ID: String(APP_ID),
  NABATABLE_CI_GITHUB_APP_INSTALLATION_ID: String(INSTALLATION_ID),
  NABATABLE_CI_GITHUB_REPOSITORY: 'nabatable/nabatable',
  NABATABLE_CI_GITHUB_REPOSITORY_ID: String(REPO_ID),
  NABATABLE_CI_REPOSITORY_ID: String(REPO_ID),
  NABATABLE_CI_JOB_IMAGE: `ci-registry.local/nabatable/ci-job@${DIGEST_1}`,
  NABATABLE_CI_JOB_IMAGE_DIGEST: DIGEST_1,
  NABATABLE_CI_HEARTBEAT_URL: 'https://ops.example.test/heartbeat',
  NABATABLE_CI_KEYCHAIN_ACCOUNT: 'nabatable-ci',
  NABATABLE_CI_KEYCHAIN_GITHUB_APP_KEY: DEFAULT_KEYCHAIN_GITHUB_APP_KEY,
  NABATABLE_CI_KEYCHAIN_HEARTBEAT_TOKEN: DEFAULT_KEYCHAIN_HEARTBEAT_TOKEN,
};

function load(
  env: Record<string, string>,
  policy: TrustPolicy = trustPolicy(),
  files: { exists?: boolean; mode?: number | null } = {},
) {
  return loadConfig({
    env,
    cwd: '/Users/nabatable-ci/nabatable-ci/current',
    home: '/Users/nabatable-ci',
    fileExists: () => files.exists ?? true,
    fileMode: () => (files.mode === undefined ? 0o600 : files.mode),
    loadOperatingConfig: () => operating,
    loadTrustPolicy: () => policy,
  });
}

function problemsOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof ConfigError) return error.problems.join('\n');
    throw error;
  }
  throw new Error('expected a ConfigError');
}

describe('controller CLI arguments', () => {
  it('parses flags and rejects unknown ones', () => {
    expect(parseArgs([])).toEqual({
      once: false,
      checkConfig: false,
      store: 'sqlite',
      help: false,
    });
    expect(parseArgs(['--once', '--store', 'memory'])).toMatchObject({
      once: true,
      store: 'memory',
    });
    expect(parseArgs(['--store=memory', '--check-config'])).toMatchObject({
      store: 'memory',
      checkConfig: true,
    });
    expect(parseArgs(['-h']).help).toBe(true);
    expect(() => parseArgs(['--store', 'redis'])).toThrow(CliArgumentError);
    expect(() => parseArgs(['--bogus'])).toThrow(CliArgumentError);
    for (const names of Object.values(ENV)) {
      if (names[0] !== 'NABATABLE_CI_LOG_LEVEL') expect(HELP).toContain(names[0]);
    }
    expect(HELP).toContain('node22');
  });
});

describe('controller configuration', () => {
  it('resolves a complete configuration from the controller.env / controller.sh contract', () => {
    const config = load(fullEnv);
    expect(config.controller.repositoryId).toBe(REPO_ID);
    expect(config.controller.installationId).toBe(INSTALLATION_ID);
    expect(config.github).toEqual({
      appId: APP_ID,
      installationId: INSTALLATION_ID,
      repository: 'nabatable/nabatable',
      appKey: {
        kind: 'keychain',
        service: DEFAULT_KEYCHAIN_GITHUB_APP_KEY,
        account: DEFAULT_KEYCHAIN_ACCOUNT,
      },
    });
    expect(config.controller.imageDigest).toBe(DIGEST_1);
    expect(config.controller.nightlyHourLondon).toBe(0);
    expect(config.controller.policyVersions).toEqual({
      pr: POLICY_VERSION,
      main: POLICY_VERSION,
      nightly: POLICY_VERSION,
    });
    expect(config.heartbeat).toEqual({
      url: 'https://ops.example.test/heartbeat',
      keychainService: DEFAULT_KEYCHAIN_HEARTBEAT_TOKEN,
      keychainAccount: 'nabatable-ci',
    });
    expect(config.paths.repoRoot).toBe('/Users/nabatable-ci/nabatable-ci/current');
    expect(config.paths.queueDb).toBe(
      '/Users/nabatable-ci/Library/Application Support/nabatable-local-ci/queue.sqlite',
    );
    expect(config.executor).toEqual({ command: 'pnpm', args: ['ci:executor'] });
  });

  it('defaults the Keychain item names to the shared contract when the wrapper exports nothing', () => {
    const env = { ...fullEnv };
    delete env.NABATABLE_CI_KEYCHAIN_ACCOUNT;
    delete env.NABATABLE_CI_KEYCHAIN_GITHUB_APP_KEY;
    delete env.NABATABLE_CI_KEYCHAIN_HEARTBEAT_TOKEN;
    const config = load(env);
    expect(config.github.appKey).toEqual({
      kind: 'keychain',
      service: DEFAULT_KEYCHAIN_GITHUB_APP_KEY,
      account: DEFAULT_KEYCHAIN_ACCOUNT,
    });
    expect(config.heartbeat.keychainService).toBe(DEFAULT_KEYCHAIN_HEARTBEAT_TOKEN);
    expect(config.heartbeat.keychainAccount).toBe(DEFAULT_KEYCHAIN_ACCOUNT);
  });

  it('accepts the legacy NABATABLE_LOCAL_CI_* / NABATABLE_CI_IMAGE_DIGEST aliases when they agree', () => {
    const env: Record<string, string> = {
      NABATABLE_LOCAL_CI_APP_ID: String(APP_ID),
      NABATABLE_LOCAL_CI_INSTALLATION_ID: String(INSTALLATION_ID),
      NABATABLE_CI_REPOSITORY: 'nabatable/nabatable',
      NABATABLE_CI_REPOSITORY_ID: String(REPO_ID),
      NABATABLE_CI_IMAGE_DIGEST: DIGEST_1,
      NABATABLE_CI_HEARTBEAT_URL: 'https://ops.example.test/heartbeat',
      NABATABLE_CI_HEARTBEAT_KEYCHAIN_SERVICE: DEFAULT_KEYCHAIN_HEARTBEAT_TOKEN,
      NABATABLE_CI_HEARTBEAT_KEYCHAIN_ACCOUNT: 'nabatable-ci',
    };
    const config = load(env);
    expect(config.github.appId).toBe(APP_ID);
    expect(config.controller.imageDigest).toBe(DIGEST_1);
    expect(problemsOf(() => load({ ...fullEnv, NABATABLE_LOCAL_CI_APP_ID: '1' }))).toMatch(
      /NABATABLE_CI_GITHUB_APP_ID and NABATABLE_LOCAL_CI_APP_ID disagree/u,
    );
    expect(problemsOf(() => load({ ...fullEnv, NABATABLE_CI_IMAGE_DIGEST: DIGEST_2 }))).toMatch(
      /disagree/u,
    );
  });

  it('rejects placeholders and missing identifiers with every problem listed', () => {
    const problems = problemsOf(() =>
      load({
        ...fullEnv,
        NABATABLE_CI_GITHUB_REPOSITORY_ID: 'REPLACE_ME_REPOSITORY_ID',
        NABATABLE_CI_REPOSITORY_ID: '',
        NABATABLE_CI_GITHUB_APP_ID: '',
        NABATABLE_CI_HEARTBEAT_URL: 'http://ops.example.test/heartbeat',
        NABATABLE_CI_JOB_IMAGE_DIGEST: 'sha256:REPLACE_ME_JOB_IMAGE_DIGEST',
        NABATABLE_CI_JOB_IMAGE: '',
      }),
    );
    expect(problems).toMatch(/NABATABLE_CI_GITHUB_REPOSITORY_ID still contains a placeholder/u);
    expect(problems).toMatch(
      /NABATABLE_CI_GITHUB_APP_ID is not set \(alias: NABATABLE_LOCAL_CI_APP_ID\)/u,
    );
    expect(problems).toMatch(/NABATABLE_CI_HEARTBEAT_URL must be an https URL/u);
    expect(problems).toMatch(/NABATABLE_CI_JOB_IMAGE_DIGEST still contains a placeholder/u);
  });

  it('uses a 0600 PEM file instead of the Keychain when NABATABLE_LOCAL_CI_PRIVATE_KEY_PATH is set', () => {
    const env = { ...fullEnv, NABATABLE_LOCAL_CI_PRIVATE_KEY_PATH: KEY_PATH };
    expect(load(env).github.appKey).toEqual({ kind: 'file', path: KEY_PATH });
    expect(problemsOf(() => load(env, trustPolicy(), { exists: false }))).toMatch(
      /does not exist/u,
    );
    expect(problemsOf(() => load(env, trustPolicy(), { mode: 0o644 }))).toMatch(/chmod 600/u);
    expect(problemsOf(() => load(env, trustPolicy(), { mode: null }))).toMatch(/not readable/u);
    expect(
      problemsOf(() => load({ ...env, NABATABLE_LOCAL_CI_PRIVATE_KEY_PATH: 'run/key.pem' })),
    ).toMatch(/absolute path/u);
  });

  it('cross-checks the tuple image digest against the pinned job image and the policy version against the catalog', () => {
    expect(
      problemsOf(() =>
        load({
          ...fullEnv,
          NABATABLE_CI_JOB_IMAGE: `ci-registry.local/nabatable/ci-job@${DIGEST_2}`,
        }),
      ),
    ).toMatch(/does not match the digest pinned in NABATABLE_CI_JOB_IMAGE/u);
    expect(
      problemsOf(() =>
        load({ ...fullEnv, NABATABLE_CI_JOB_IMAGE: 'ci-registry.local/nabatable/ci-job:latest' }),
      ),
    ).toMatch(/digest-pinned/u);
    expect(
      problemsOf(() =>
        load({
          ...fullEnv,
          NABATABLE_CI_JOB_IMAGE_DIGEST: 'sha256:short',
          NABATABLE_CI_JOB_IMAGE: '',
        }),
      ),
    ).toMatch(/sha256:<64 lowercase hex>/u);
    expect(
      problemsOf(() => load({ ...fullEnv, NABATABLE_CI_POLICY_VERSION: '2020-01-01.1' })),
    ).toMatch(/does not match the profile catalog policy version/u);
    expect(
      load({ ...fullEnv, NABATABLE_CI_POLICY_VERSION: POLICY_VERSION }).controller.policyVersions
        .pr,
    ).toBe(POLICY_VERSION);
  });

  it('refuses a trust policy pinned to a different repository id and reports unconfigured ones', () => {
    expect(
      problemsOf(() => load(fullEnv, trustPolicy({ trustedRepositoryId: REPO_ID + 1 }))),
    ).toMatch(/trustedRepositoryId/u);
    const config = load(fullEnv, trustPolicy({ trustedRepositoryId: 'REPLACE_ME_REPOSITORY_ID' }));
    const described = describeConfig(config) as { trustPolicy: { configured: boolean } };
    expect(described.trustPolicy.configured).toBe(false);
  });

  it('bounds attempts and validates identifiers', () => {
    expect(problemsOf(() => load({ ...fullEnv, NABATABLE_CI_MAX_ATTEMPTS: '9' }))).toMatch(
      /must not exceed 5/u,
    );
    expect(problemsOf(() => load({ ...fullEnv, NABATABLE_CI_CONTROLLER_ID: 'bad id!' }))).toMatch(
      /NABATABLE_CI_CONTROLLER_ID/u,
    );
    expect(
      problemsOf(() => load({ ...fullEnv, NABATABLE_CI_GITHUB_REPOSITORY: 'not-a-repo' })),
    ).toMatch(/owner\/repo/u);
  });

  it('describeConfig exposes identifiers and item names only', () => {
    const described = JSON.stringify(describeConfig(load(fullEnv)));
    expect(described).toContain(String(APP_ID));
    expect(described).toContain(DEFAULT_KEYCHAIN_GITHUB_APP_KEY);
    expect(described).toContain(DEFAULT_KEYCHAIN_HEARTBEAT_TOKEN);
    expect(described).not.toMatch(/BEGIN|privateKeyPem|"token"/u);
    expect(described).toContain('"activeRuntime":"node22"');
    expect(described).toContain('"candidateRuntime":"node24"');
  });
});

describe('key material helpers', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----';

  it('accepts PEM verbatim or base64-encoded', () => {
    expect(decodePrivateKeyMaterial(`${pem}\n`)).toBe(`${pem}\n`);
    expect(decodePrivateKeyMaterial(Buffer.from(pem).toString('base64'))).toBe(`${pem}\n`);
    expect(() => decodePrivateKeyMaterial('ghs_notakey')).toThrow(/neither PEM nor base64/u);
  });

  it('extracts the digest pinned in an image reference', () => {
    expect(imageReferenceDigest(`repo/image@${DIGEST_1}`)).toBe(DIGEST_1);
    expect(imageReferenceDigest('repo/image:tag')).toBeNull();
    expect(imageReferenceDigest('repo/image@sha256:nope')).toBeNull();
  });
});
