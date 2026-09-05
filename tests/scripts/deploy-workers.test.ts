import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { digestWorkerConfigs, loadWorkerConfigs } from '@/scripts/deploy/validate-separation';
import {
  WorkerDeployRefusedError,
  assertSeparationEvidence,
  deployWorker,
  envArgs,
  main,
  parseLatestVersionId,
  parseVersionId,
  resolveWorkerBaseUrl,
  versionsUnsupported,
} from '@/scripts/deploy/workers';
import { readWranglerConfig, wranglerConfigPath } from '@/scripts/deploy/wrangler-config';

import type { CommandRunner } from '@/scripts/deploy/exec';

const ROOT = process.cwd();
const SHA = 'e'.repeat(40);
const NEW_VERSION = '11111111-2222-4333-8444-555555555555';
const OLD_VERSION = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const NOW = new Date('2026-09-05T12:00:00.000Z');

function currentDigest(): string {
  return digestWorkerConfigs(loadWorkerConfigs(ROOT));
}

function separationEvidence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'separation-validation',
    target: 'staging',
    ok: true,
    findings: [],
    checkedFields: 40,
    configDigest: currentDigest(),
    vercelConfigDigest: null,
    workers: [],
    checkedAt: '2026-09-05T11:30:00.000Z',
    ...overrides,
  };
}

function fakeWrangler(options: { supportsVersions: boolean }): {
  runner: CommandRunner;
  calls: string[][];
} {
  const calls: string[][] = [];
  const runner: CommandRunner = (command, args) => {
    calls.push([command, ...args]);
    const [group, action] = args;
    if (group === 'versions' && action === 'list') {
      return options.supportsVersions
        ? {
            status: 0,
            stdout: JSON.stringify([
              { id: OLD_VERSION, metadata: { created_on: '2026-09-01T00:00:00Z' } },
              {
                id: 'older-version-id-0000-0000-000000000000',
                metadata: { created_on: '2026-08-01T00:00:00Z' },
              },
            ]),
            stderr: '',
          }
        : { status: 1, stdout: '', stderr: 'Unknown argument: versions' };
    }
    if (group === 'versions' && action === 'upload') {
      return options.supportsVersions
        ? {
            status: 0,
            stdout: `Uploaded nabatable-sms-summary-gateway-staging\nWorker Version ID: ${NEW_VERSION}\n`,
            stderr: '',
          }
        : { status: 1, stdout: '', stderr: "Unknown command: versions. Did you mean 'deploy'?" };
    }
    if (group === 'versions' && action === 'deploy') {
      return { status: 0, stdout: 'Deployed', stderr: '' };
    }
    if (group === 'deploy') {
      return { status: 0, stdout: `Current Version ID: ${NEW_VERSION}`, stderr: '' };
    }
    if (group === 'd1') return { status: 0, stdout: 'ok', stderr: '' };
    return { status: 1, stdout: '', stderr: `unexpected ${args.join(' ')}` };
  };
  return { runner, calls };
}

function readyFetch(revision: string) {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (headers.authorization !== 'Bearer fake-monitoring-token') {
      return new Response('{"error":"Unauthorized"}', { status: 401 });
    }
    expect(url).toBe('https://sms-staging.example.workers.dev/ready');
    return new Response(JSON.stringify({ status: 'ok', revision }), { status: 200 });
  };
}

describe('deploy:workers', () => {
  const tempDirs: string[] = [];
  const tempDir = () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'worker-deploy-'));
    tempDirs.push(dir);
    return dir;
  };
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('refuses to deploy without separation evidence for the target @deploy @security', async () => {
    const dir = tempDir();
    const { runner, calls } = fakeWrangler({ supportsVersions: true });
    await expect(
      deployWorker({
        worker: 'sms-summary-gateway',
        target: 'staging',
        sourceRevision: SHA,
        monitoringToken: 'fake-monitoring-token',
        rootDir: ROOT,
        separationEvidencePath: path.join(dir, 'missing.json'),
        evidencePath: path.join(dir, 'worker.json'),
        baseUrl: 'https://sms-staging.example.workers.dev',
        runner,
        env: {},
      }),
    ).rejects.toThrow(/could not be read/u);
    expect(calls).toEqual([]);
  });

  it('rejects evidence that is for another target, failed, stale or too old @deploy @security', () => {
    const digest = currentDigest();
    const base = { target: 'staging' as const, currentDigest: digest, now: NOW };
    expect(() =>
      assertSeparationEvidence({ ...base, evidence: separationEvidence() }),
    ).not.toThrow();
    expect(() =>
      assertSeparationEvidence({ ...base, evidence: separationEvidence({ target: 'production' }) }),
    ).toThrow(/not "staging"/u);
    expect(() =>
      assertSeparationEvidence({ ...base, evidence: separationEvidence({ ok: false }) }),
    ).toThrow(/did not pass/u);
    expect(() =>
      assertSeparationEvidence({
        ...base,
        evidence: separationEvidence({ configDigest: 'f'.repeat(64) }),
      }),
    ).toThrow(/stale/u);
    expect(() =>
      assertSeparationEvidence({
        ...base,
        evidence: separationEvidence({ checkedAt: '2026-09-03T11:30:00.000Z' }),
      }),
    ).toThrow(/older than 24h/u);
    expect(() => assertSeparationEvidence({ ...base, evidence: { kind: 'other' } })).toThrow(
      WorkerDeployRefusedError,
    );
  });

  it('uploads a version, deploys it at 100%, verifies /ready and records rollback evidence @deploy', async () => {
    const dir = tempDir();
    const separationEvidencePath = path.join(dir, 'separation-staging.json');
    writeFileSync(separationEvidencePath, JSON.stringify(separationEvidence()));
    const evidencePath = path.join(dir, 'worker-sms-staging.json');
    const { runner, calls } = fakeWrangler({ supportsVersions: true });
    const evidence = await deployWorker({
      worker: 'sms-summary-gateway',
      target: 'staging',
      sourceRevision: SHA,
      monitoringToken: 'fake-monitoring-token',
      rootDir: ROOT,
      separationEvidencePath,
      evidencePath,
      baseUrl: 'https://sms-staging.example.workers.dev',
      runner,
      fetchImpl: readyFetch(SHA),
      env: {},
      now: () => NOW,
    });
    expect(evidence.strategy).toBe('versions');
    expect(evidence.versionId).toBe(NEW_VERSION);
    expect(evidence.previousVersionId).toBe(OLD_VERSION);
    expect(evidence.workerName).toBe('nabatable-sms-summary-gateway-staging');
    expect(evidence.rollbackCommand).toContain(`wrangler rollback ${OLD_VERSION}`);
    expect(evidence.rollbackCommand).toContain('--env staging');
    const configPath = path.join(ROOT, 'cloudflare', 'sms-summary-gateway', 'wrangler.jsonc');
    expect(calls.map((call) => call.slice(0, 3).join(' '))).toEqual([
      'wrangler versions list',
      'wrangler versions upload',
      'wrangler versions deploy',
    ]);
    for (const call of calls) {
      expect(call).toContain('--config');
      expect(call).toContain(configPath);
      expect(call.slice(call.indexOf('--env') + 1)[0]).toBe('staging');
    }
    const upload = calls[1] ?? [];
    expect(upload).toContain(`DEPLOY_SHA:${SHA}`);
    expect(upload).toContain(`NABATABLE_SOURCE_REVISION:${SHA}`);
    expect(calls[2]).toContain(`${NEW_VERSION}@100%`);
    const written = JSON.parse(readFileSync(evidencePath, 'utf8')) as {
      kind: string;
      verified: boolean;
    };
    expect(written.kind).toBe('worker-deployment');
    expect(written.verified).toBe(true);
    expect(JSON.stringify(written)).not.toContain('fake-monitoring-token');
  });

  it('falls back to wrangler deploy when versions are unsupported and applies D1 migrations first @deploy', async () => {
    const dir = tempDir();
    const separationEvidencePath = path.join(dir, 'separation-production.json');
    writeFileSync(
      separationEvidencePath,
      JSON.stringify(separationEvidence({ target: 'production' })),
    );
    const { runner, calls } = fakeWrangler({ supportsVersions: false });
    const evidence = await deployWorker({
      worker: 'booking-short-links',
      target: 'production',
      sourceRevision: SHA,
      monitoringToken: 'fake-monitoring-token',
      rootDir: ROOT,
      separationEvidencePath,
      evidencePath: path.join(dir, 'worker.json'),
      baseUrl: 'https://sms-staging.example.workers.dev',
      runner,
      fetchImpl: readyFetch(SHA),
      env: {},
      now: () => NOW,
    });
    expect(evidence.strategy).toBe('deploy');
    expect(evidence.previousVersionId).toBeNull();
    expect(calls.map((call) => call.slice(0, 3).join(' '))).toEqual([
      'wrangler versions list',
      'wrangler d1 migrations',
      'wrangler versions upload',
      'wrangler deploy --config',
    ]);
    expect(calls.some((call) => call.includes('--env'))).toBe(false);
    expect(envArgs('production')).toEqual([]);
  });

  it('refuses when readiness reports another revision and writes no evidence @deploy @security', async () => {
    const dir = tempDir();
    const separationEvidencePath = path.join(dir, 'separation-staging.json');
    writeFileSync(separationEvidencePath, JSON.stringify(separationEvidence()));
    const evidencePath = path.join(dir, 'worker.json');
    const { runner } = fakeWrangler({ supportsVersions: true });
    await expect(
      deployWorker({
        worker: 'email-queue-gateway',
        target: 'staging',
        sourceRevision: SHA,
        monitoringToken: 'fake-monitoring-token',
        rootDir: ROOT,
        separationEvidencePath,
        evidencePath,
        baseUrl: 'https://sms-staging.example.workers.dev',
        runner,
        fetchImpl: readyFetch('d'.repeat(40)),
        readinessAttempts: 2,
        sleep: async () => undefined,
        env: {},
        now: () => NOW,
      }),
    ).rejects.toThrow(/revision mismatch/u);
    expect(existsSync(evidencePath)).toBe(false);
  });

  it('refuses a staging readiness URL that is still a placeholder @deploy @security', async () => {
    const dir = tempDir();
    const separationEvidencePath = path.join(dir, 'separation-staging.json');
    writeFileSync(separationEvidencePath, JSON.stringify(separationEvidence()));
    const { runner, calls } = fakeWrangler({ supportsVersions: true });
    await expect(
      deployWorker({
        worker: 'sms-summary-gateway',
        target: 'staging',
        sourceRevision: SHA,
        monitoringToken: 'fake-monitoring-token',
        rootDir: ROOT,
        separationEvidencePath,
        evidencePath: path.join(dir, 'worker.json'),
        baseUrl: 'https://REPLACE_ME_SUBDOMAIN.workers.dev',
        runner,
        fetchImpl: async () => {
          throw new Error('Unexpected readiness request');
        },
        env: {},
        now: () => NOW,
      }),
    ).rejects.toThrow(/no readiness URL/u);
    expect(calls).toEqual([]);
  });

  it('resolves the email-queue-gateway readiness origin only from --url or WORKER_URL_EMAIL_QUEUE_GATEWAY @deploy', () => {
    const config = readWranglerConfig(wranglerConfigPath(ROOT, 'email-queue-gateway'));
    const base = { worker: 'email-queue-gateway' as const, config };
    for (const target of ['staging', 'production'] as const) {
      expect(() => resolveWorkerBaseUrl({ ...base, target, env: {} })).toThrow(
        /set WORKER_URL_EMAIL_QUEUE_GATEWAY/u,
      );
      expect(() =>
        resolveWorkerBaseUrl({
          ...base,
          target,
          env: { WORKER_URL_EMAIL_QUEUE_GATEWAY: 'https://REPLACE_ME_SUBDOMAIN.workers.dev' },
        }),
      ).toThrow(WorkerDeployRefusedError);
      expect(
        resolveWorkerBaseUrl({
          ...base,
          target,
          env: { WORKER_URL_EMAIL_QUEUE_GATEWAY: `https://email-${target}.example.workers.dev` },
        }),
      ).toBe(`https://email-${target}.example.workers.dev`);
    }
  });

  it('deploys email-queue-gateway through the CLI with only WORKER_URL_EMAIL_QUEUE_GATEWAY set @deploy', async () => {
    const dir = tempDir();
    const separationEvidencePath = path.join(dir, 'separation-staging.json');
    writeFileSync(separationEvidencePath, JSON.stringify(separationEvidence()));
    const evidencePath = path.join(dir, 'worker-email-staging.json');
    const { runner, calls } = fakeWrangler({ supportsVersions: true });
    const seen: string[] = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      seen.push(url);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (headers.authorization !== 'Bearer fake-monitoring-token') {
        return new Response('{"error":"Unauthorized"}', { status: 401 });
      }
      return new Response(JSON.stringify({ status: 'ok', revision: SHA }), { status: 200 });
    };
    const argv = [
      '--env',
      'staging',
      '--worker',
      'email-queue-gateway',
      '--root',
      ROOT,
      '--separation-evidence',
      separationEvidencePath,
      '--evidence',
      evidencePath,
    ];
    const env = {
      NABATABLE_SOURCE_REVISION: SHA,
      MONITORING_TOKEN: 'fake-monitoring-token',
      WORKER_URL_EMAIL_QUEUE_GATEWAY: 'https://email-staging.example.workers.dev',
    };
    const write = process.stdout.write.bind(process.stdout);
    const output: string[] = [];
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    try {
      await expect(main(argv, env, { runner, fetchImpl, now: () => NOW })).resolves.toBe(0);
    } finally {
      process.stdout.write = write;
    }
    expect(seen).toEqual(['https://email-staging.example.workers.dev/ready']);
    expect(calls.map((call) => call.slice(0, 3).join(' '))).toEqual([
      'wrangler versions list',
      'wrangler versions upload',
      'wrangler versions deploy',
    ]);
    const written = JSON.parse(readFileSync(evidencePath, 'utf8')) as {
      worker: string;
      readiness: { url: string };
    };
    expect(written.worker).toBe('email-queue-gateway');
    expect(written.readiness.url).toBe('https://email-staging.example.workers.dev/ready');
    expect(output.join('')).toContain('nabatable-email-queue-gateway-staging');

    // Without the variable the CLI refuses before wrangler is ever invoked.
    calls.length = 0;
    const withoutUrl = {
      NABATABLE_SOURCE_REVISION: SHA,
      MONITORING_TOKEN: 'fake-monitoring-token',
    };
    await expect(main(argv, withoutUrl, { runner, fetchImpl, now: () => NOW })).rejects.toThrow(
      /set WORKER_URL_EMAIL_QUEUE_GATEWAY/u,
    );
    expect(calls).toEqual([]);
  });

  it('parses wrangler output defensively @deploy', () => {
    expect(parseVersionId(`Worker Version ID: ${NEW_VERSION}`)).toBe(NEW_VERSION);
    expect(parseVersionId('nothing')).toBeNull();
    expect(
      versionsUnsupported({ status: 1, stdout: '', stderr: 'Unknown argument: versions' }),
    ).toBe(true);
    expect(versionsUnsupported({ status: 1, stdout: '', stderr: 'Authentication error' })).toBe(
      false,
    );
    expect(parseLatestVersionId('not json')).toBeNull();
    expect(
      parseLatestVersionId(
        JSON.stringify([
          { id: 'b', metadata: { created_on: '2026-01-02T00:00:00Z' } },
          { id: 'a', metadata: { created_on: '2026-01-03T00:00:00Z' } },
        ]),
      ),
    ).toBe('a');
  });
});
