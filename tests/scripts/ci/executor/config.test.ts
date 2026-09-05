import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  assertConfigured,
  ExecutorUnconfiguredError,
  isPlaceholder,
  loadExecutorConfig,
} from '@/scripts/ci/executor/config';

import { cleanupTempDirs, configuredEnv, IMAGE_DIGEST, repositoryRoot } from './helpers';

afterEach(cleanupTempDirs);

describe('loadExecutorConfig', () => {
  it('loads a fully configured environment and the VM facts from infra/local-ci/operating.json', () => {
    const fixture = configuredEnv();
    const loaded = loadExecutorConfig(fixture.env, repositoryRoot);
    expect(loaded.problems).toEqual([]);
    const config = assertConfigured(loaded);
    expect(config.lima.dockerContext).toBe('nabatable-ci');
    expect(config.lima.protectedDockerContexts).toContain('default');
    expect(config.lima.egressScript).toBe('/etc/nabatable-ci/network/egress.sh');
    expect(config.docker.jobNetwork).toBe('nabatable-ci-jobs');
    const facts = JSON.parse(
      readFileSync(path.join(repositoryRoot, 'infra/local-ci/operating.json'), 'utf8'),
    ) as { job: { image: { uid: number } } };
    expect(facts.job.image.uid).toBeGreaterThan(0);
    expect(config.docker.user).toBe(`${facts.job.image.uid}:${facts.job.image.uid}`);
    expect(config.docker.imageDigest).toBe(IMAGE_DIGEST);
    expect(config.docker.egressProxyUrl).toMatch(/^http:\/\/10\.90\.0\.\d+:8888$/u);
    expect(config.docker.seccompProfilePath).toBe(
      path.join(repositoryRoot, 'infra/local-ci/seccomp/ci-job.json'),
    );
    expect(config.keychain).toEqual({
      account: 'nabatable-ci',
      r2AccessKeyIdService: 'nabatable-ci/r2/evidence/access-key-id',
      r2SecretAccessKeyService: 'nabatable-ci/r2/evidence/secret-access-key',
    });
    expect(config.retention).toEqual({
      maxAgeMs: 7 * 24 * 60 * 60 * 1000,
      maxTotalBytes: 10 * 1024 * 1024 * 1024,
    });
  });

  it('composes the job image from name and digest when only the digest is given', () => {
    const fixture = configuredEnv({
      NABATABLE_CI_JOB_IMAGE: '',
      NABATABLE_CI_JOB_IMAGE_DIGEST: IMAGE_DIGEST,
    });
    const config = assertConfigured(loadExecutorConfig(fixture.env, repositoryRoot));
    expect(config.docker.image).toBe(`nabatable/ci-job@${IMAGE_DIGEST}`);
  });

  it('reports placeholders and malformed values as problems instead of using them', () => {
    const fixture = configuredEnv({
      NABATABLE_CI_JOB_IMAGE: 'nabatable/ci-job@sha256:REPLACE_ME_CI_JOB_IMAGE_DIGEST',
      NABATABLE_CI_BASE_IMAGE_DIGEST: `sha256:${'0'.repeat(64)}`,
      NABATABLE_CI_SOURCE_REMOTE_URL: 'https://user:token@github.com/example/repo.git',
      NABATABLE_CI_R2_BUCKET: 'REPLACE_ME_BUCKET',
      NABATABLE_CI_SPOOL_ROOT: 'relative/spool',
    });
    const loaded = loadExecutorConfig(fixture.env, repositoryRoot);
    expect(loaded.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('docker.image'),
        expect.stringContaining('lima.baseImageDigest'),
        expect.stringContaining('sourceRemoteUrl'),
        expect.stringContaining('r2.bucket'),
        expect.stringContaining('spoolRoot'),
      ]),
    );
    expect(() => assertConfigured(loaded)).toThrow(ExecutorUnconfiguredError);
  });

  it('refuses a protected docker context and a missing facts file', () => {
    const fixture = configuredEnv();
    const facts = path.join(fixture.root, 'facts.json');
    writeFileSync(
      facts,
      JSON.stringify({
        vm: { dockerContext: 'default', dockerContextProtectedNames: ['default'] },
        job: {
          image: { uid: 10001 },
          network: {
            jobNetwork: { name: 'jobs' },
            proxy: { jobFacingAddress: '10.90.0.1', port: 8888 },
          },
          guestPaths: { egressScript: '/etc/x/egress.sh' },
        },
        controller: {
          keychainItems: { r2EvidenceAccessKeyId: 'a', r2EvidenceSecretAccessKey: 'b' },
        },
      }),
    );
    const loaded = loadExecutorConfig(
      { ...fixture.env, NABATABLE_CI_OPERATING_FACTS: facts },
      repositoryRoot,
    );
    expect(loaded.problems).toEqual([
      expect.stringMatching(/docker context default is protected/u),
    ]);

    const missing = loadExecutorConfig(
      { ...fixture.env, NABATABLE_CI_OPERATING_FACTS: path.join(fixture.root, 'nope.json') },
      repositoryRoot,
    );
    expect(missing.problems.some((problem) => problem.includes('does not exist'))).toBe(true);
  });

  it('reads the optional executor.json and lets env override it', () => {
    const fixture = configuredEnv();
    const file = path.join(fixture.root, 'executor.json');
    writeFileSync(file, JSON.stringify({ r2KeyPrefix: 'from-file/prefix', limaCpus: 2 }));
    const config = assertConfigured(
      loadExecutorConfig(
        { ...fixture.env, NABATABLE_CI_EXECUTOR_CONFIG: file, NABATABLE_CI_LIMA_CPUS: '3' },
        repositoryRoot,
      ),
    );
    expect(config.r2.keyPrefix).toBe('from-file/prefix');
    expect(config.lima.cpus).toBe(3);
  });

  it('recognises placeholders', () => {
    expect(isPlaceholder('REPLACE_ME_STAGING_D1_ID')).toBe(true);
    expect(isPlaceholder('<your-bucket>')).toBe(true);
    expect(isPlaceholder(`sha256:${'0'.repeat(64)}`)).toBe(true);
    expect(isPlaceholder('')).toBe(true);
    expect(isPlaceholder(undefined)).toBe(true);
    expect(isPlaceholder('real-value')).toBe(false);
  });
});
