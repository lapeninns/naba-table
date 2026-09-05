import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProviderCliError, loadProviderCliPins } from '@/scripts/deploy/provider-clis';
import { ReadinessError, verifyReadiness } from '@/scripts/deploy/readiness';
import {
  buildArgs,
  deployArgs,
  deployVercelPrebuilt,
  parseDeploymentId,
  parseDeploymentUrl,
  pullArgs,
} from '@/scripts/deploy/vercel-prebuilt';
import {
  PromotionRefusedError,
  assertPromotable,
  promoteVercelDeployment,
} from '@/scripts/deploy/vercel-promote';

import type { CommandRunner } from '@/scripts/deploy/exec';

const SHA = 'f'.repeat(40);
const OTHER_SHA = '1'.repeat(40);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const PINNED_VERCEL = loadProviderCliPins().vercel;

function fakeVercel(options: { version?: string } = {}): {
  runner: CommandRunner;
  calls: string[][];
} {
  const calls: string[][] = [];
  const runner: CommandRunner = (command, args) => {
    calls.push([command, ...args]);
    if (args[0] === '--version') {
      const version = options.version ?? PINNED_VERCEL;
      return { status: 0, stdout: `Vercel CLI ${version}\n${version}\n`, stderr: '' };
    }
    if (args[0] === 'deploy') {
      return {
        status: 0,
        stdout:
          'Inspect: https://vercel.com/team/nabatable/abc\nhttps://nabatable-k3j2h1.vercel.app\n',
        stderr: '',
      };
    }
    if (args[0] === 'inspect') {
      return { status: 0, stdout: '', stderr: '> id\tdpl_9A8b7C6d5E\n> name\tnabatable\n' };
    }
    return { status: 0, stdout: '', stderr: '' };
  };
  return { runner, calls };
}

describe('deploy:vercel:prebuilt', () => {
  const tempDirs: string[] = [];
  const tempDir = () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'vercel-deploy-'));
    tempDirs.push(dir);
    return dir;
  };
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('relies on prebuilt + skip-domain flags and selects the target environment @deploy @contract', () => {
    expect(pullArgs('staging')).toEqual(['pull', '--yes', '--environment=staging']);
    expect(buildArgs('staging')).toEqual(['build', '--yes', '--target=staging']);
    expect(deployArgs('staging')).toEqual([
      'deploy',
      '--prebuilt',
      '--skip-domain',
      '--yes',
      '--target=staging',
    ]);
    expect(deployArgs('production')).toEqual([
      'deploy',
      '--prebuilt',
      '--skip-domain',
      '--yes',
      '--prod',
    ]);
    expect(parseDeploymentUrl('x https://nabatable-abc.vercel.app y')).toBe(
      'https://nabatable-abc.vercel.app',
    );
    expect(() => parseDeploymentUrl('nothing here')).toThrow(/deployment URL/u);
    expect(parseDeploymentId('id dpl_Abc123')).toBe('dpl_Abc123');
  });

  it('builds, deploys, verifies /api/ready with the monitoring token and writes evidence @deploy', async () => {
    const dir = tempDir();
    const { runner, calls } = fakeVercel();
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(url).toBe('https://nabatable-k3j2h1.vercel.app/api/ready');
      expect(headers.authorization).toBe('Bearer fake-monitoring-token');
      expect(headers['x-vercel-protection-bypass']).toBe('bypass-fake');
      return jsonResponse({ status: 'ok', revision: SHA, deploymentId: 'dpl_9A8b7C6d5E' });
    });
    const evidencePath = path.join(dir, 'vercel-staging.json');
    const evidence = await deployVercelPrebuilt({
      target: 'staging',
      sourceRevision: SHA,
      monitoringToken: 'fake-monitoring-token',
      rootDir: dir,
      evidencePath,
      runner,
      fetchImpl,
      env: { VERCEL_AUTOMATION_BYPASS_SECRET: 'bypass-fake' },
      now: () => new Date('2026-09-05T12:00:00.000Z'),
    });
    expect(evidence.deploymentId).toBe('dpl_9A8b7C6d5E');
    expect(evidence.deploymentUrl).toBe('https://nabatable-k3j2h1.vercel.app');
    expect(evidence.verified).toBe(true);
    expect(evidence.readiness.buildId).toBe('dpl_9A8b7C6d5E');
    expect(evidence.activeRuntime).toBe('node22');
    expect(evidence.candidateRuntime).toBe('node24');
    expect(evidence.providerCli).toEqual({ name: 'vercel', version: PINNED_VERCEL });
    expect(calls.map((call) => call.slice(0, 2).join(' '))).toEqual([
      'vercel --version',
      'vercel pull',
      'vercel build',
      'vercel deploy',
      'vercel inspect',
    ]);
    const written = JSON.parse(readFileSync(evidencePath, 'utf8')) as {
      target: string;
      commands: string[];
    };
    expect(written.target).toBe('staging');
    expect(written.commands[2]).toBe(
      'vercel deploy --prebuilt --skip-domain --yes --target=staging',
    );
    expect(JSON.stringify(written)).not.toContain('fake-monitoring-token');
    expect(JSON.stringify(written)).not.toContain('bypass-fake');
  });

  it('refuses to write evidence when readiness reports a different revision @deploy @security', async () => {
    const dir = tempDir();
    const { runner } = fakeVercel();
    const evidencePath = path.join(dir, 'vercel-production.json');
    await expect(
      deployVercelPrebuilt({
        target: 'production',
        sourceRevision: SHA,
        monitoringToken: 'fake-monitoring-token',
        rootDir: dir,
        evidencePath,
        runner,
        fetchImpl: async () => jsonResponse({ status: 'ok', revision: OTHER_SHA }),
        readinessAttempts: 2,
        sleep: async () => undefined,
        env: {},
      }),
    ).rejects.toBeInstanceOf(ReadinessError);
    expect(existsSync(evidencePath)).toBe(false);
  });

  it('refuses without a monitoring token or with a malformed revision @deploy @security', async () => {
    const dir = tempDir();
    const { runner, calls } = fakeVercel();
    await expect(
      deployVercelPrebuilt({
        target: 'staging',
        sourceRevision: SHA,
        monitoringToken: '',
        rootDir: dir,
        evidencePath: path.join(dir, 'e.json'),
        runner,
        env: {},
      }),
    ).rejects.toThrow(/MONITORING_TOKEN/u);
    await expect(
      deployVercelPrebuilt({
        target: 'staging',
        sourceRevision: 'main',
        monitoringToken: 't',
        rootDir: dir,
        evidencePath: path.join(dir, 'e.json'),
        runner,
        env: {},
      }),
    ).rejects.toThrow(/40-hex/u);
    expect(calls).toEqual([]);
  });

  it('refuses to deploy when the installed Vercel CLI does not match the pin @deploy @security', async () => {
    const dir = tempDir();
    const { runner, calls } = fakeVercel({ version: '0.0.1' });
    const evidencePath = path.join(dir, 'vercel-staging.json');
    await expect(
      deployVercelPrebuilt({
        target: 'staging',
        sourceRevision: SHA,
        monitoringToken: 'fake-monitoring-token',
        rootDir: dir,
        evidencePath,
        runner,
        env: {},
      }),
    ).rejects.toThrow(ProviderCliError);
    expect(calls).toEqual([['vercel', '--version']]);
    expect(existsSync(evidencePath)).toBe(false);
  });

  it('retries readiness until the revision appears and fails after the budget @deploy', async () => {
    const responses = [jsonResponse({}, 503), jsonResponse({ revision: SHA })];
    const result = await verifyReadiness({
      baseUrl: 'https://example.test',
      path: '/api/ready',
      expectedRevision: SHA,
      monitoringToken: 't',
      fetchImpl: async () => responses.shift() ?? jsonResponse({}, 500),
      attempts: 3,
      sleep: async () => undefined,
    });
    expect(result.attempts).toBe(2);
    await expect(
      verifyReadiness({
        baseUrl: 'https://example.test',
        path: '/api/ready',
        expectedRevision: SHA,
        monitoringToken: 't',
        fetchImpl: async () => jsonResponse({ error: 'Unauthorized' }, 401),
        attempts: 2,
        sleep: async () => undefined,
      }),
    ).rejects.toThrow(/HTTP 401/u);
  });
});

describe('deploy:vercel:promote', () => {
  const tempDirs: string[] = [];
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  const evidenceFor = (target: string, overrides: Record<string, unknown> = {}) => ({
    kind: 'vercel-deployment',
    target,
    deploymentId: 'dpl_9A8b7C6d5E',
    deploymentUrl: 'https://nabatable-k3j2h1.vercel.app',
    sourceRevision: SHA,
    verified: true,
    verifiedAt: '2026-09-05T12:00:00.000Z',
    readiness: {
      url: 'https://nabatable-k3j2h1.vercel.app/api/ready',
      revision: SHA,
      buildId: null,
      attempts: 1,
    },
    commands: [],
    ...overrides,
  });

  it('refuses staging-configured builds and unverified or mismatched evidence @deploy @security', () => {
    expect(() => assertPromotable(evidenceFor('staging'))).toThrow(PromotionRefusedError);
    expect(() => assertPromotable(evidenceFor('staging'))).toThrow(/staging-configured/u);
    expect(() => assertPromotable(evidenceFor('production', { verified: false }))).toThrow(
      /not marked verified/u,
    );
    expect(() =>
      assertPromotable(evidenceFor('production', { readiness: { revision: OTHER_SHA } })),
    ).toThrow(/does not match sourceRevision/u);
    expect(() =>
      assertPromotable(evidenceFor('production'), { expectedRevision: OTHER_SHA }),
    ).toThrow(/expected revision/u);
    expect(() =>
      assertPromotable(evidenceFor('production', { deploymentId: 'not-an-id' })),
    ).toThrow(/dpl_/u);
    expect(() => assertPromotable({ kind: 'worker-deployment' })).toThrow(/vercel-deployment/u);
    expect(() => assertPromotable(null)).toThrow(PromotionRefusedError);
  });

  it('promotes only a verified production deployment and records promotion evidence @deploy', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'vercel-promote-'));
    tempDirs.push(dir);
    const evidencePath = path.join(dir, 'vercel-production.json');
    const promotionEvidencePath = path.join(dir, 'vercel-promotion.json');
    writeFileSync(evidencePath, JSON.stringify(evidenceFor('production')));
    const { runner, calls } = fakeVercel();
    const promotion = promoteVercelDeployment({
      evidencePath,
      promotionEvidencePath,
      expectedRevision: SHA,
      runner,
      now: () => new Date('2026-09-05T12:30:00.000Z'),
    });
    expect(calls).toEqual([
      ['vercel', '--version'],
      ['vercel', 'promote', 'dpl_9A8b7C6d5E', '--yes'],
    ]);
    expect(promotion.kind).toBe('vercel-promotion');
    expect(JSON.parse(readFileSync(promotionEvidencePath, 'utf8'))).toMatchObject({
      deploymentId: 'dpl_9A8b7C6d5E',
      sourceRevision: SHA,
      promotedAt: '2026-09-05T12:30:00.000Z',
    });

    writeFileSync(evidencePath, JSON.stringify(evidenceFor('staging')));
    calls.length = 0;
    expect(() => promoteVercelDeployment({ evidencePath, promotionEvidencePath, runner })).toThrow(
      PromotionRefusedError,
    );
    expect(calls).toEqual([]);
    expect(() =>
      promoteVercelDeployment({
        evidencePath: path.join(dir, 'missing.json'),
        promotionEvidencePath,
        runner,
      }),
    ).toThrow(/could not be read/u);

    // A drifted CLI is refused before `vercel promote` is ever attempted.
    writeFileSync(evidencePath, JSON.stringify(evidenceFor('production')));
    const drifted = fakeVercel({ version: '1.2.3' });
    expect(() =>
      promoteVercelDeployment({
        evidencePath,
        promotionEvidencePath,
        expectedRevision: SHA,
        runner: drifted.runner,
      }),
    ).toThrow(ProviderCliError);
    expect(drifted.calls).toEqual([['vercel', '--version']]);
  });
});
