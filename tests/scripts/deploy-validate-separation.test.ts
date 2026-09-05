import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ENVIRONMENTS } from '@/scripts/deploy/environments';
import {
  checkVercelConfig,
  digestWorkerConfigs,
  loadVercelConfig,
  loadWorkerConfigs,
  main,
  validateSeparation,
  type WorkerConfigInput,
} from '@/scripts/deploy/validate-separation';
import { productionSection, stripJsonComments } from '@/scripts/deploy/wrangler-config';

const ROOT = process.cwd();

/** Descriptor set with every placeholder replaced so worker findings can be isolated. */
const CONFIGURED_ENVIRONMENTS: typeof ENVIRONMENTS = {
  staging: { ...ENVIRONMENTS.staging, vercelProjectId: 'prj_staging_fake_0001' },
  production: { ...ENVIRONMENTS.production, vercelProjectId: 'prj_production_fake_0002' },
};

function shortLinksConfig(overrides: {
  stagingDatabaseId?: string;
  stagingKvId?: string;
  stagingSiteUrl?: string;
  includeStaging?: boolean;
}): WorkerConfigInput {
  const staging = {
    name: 'nabatable-booking-short-links-staging',
    d1_databases: [
      {
        binding: 'BOOKING_SHORT_LINKS_DB',
        database_name: 'nabatable-booking-short-links-staging',
        database_id: overrides.stagingDatabaseId ?? 'stg-d1-0000-0000-0000-000000000001',
        migrations_dir: 'migrations',
      },
    ],
    kv_namespaces: [
      {
        binding: 'BOOKING_SHORT_LINKS_CACHE',
        id: overrides.stagingKvId ?? 'stgkv00000000000000000000000001',
      },
    ],
    vars: {
      BOOKING_SITE_URL: overrides.stagingSiteUrl ?? 'https://nabatable-staging.vercel.app',
      POSTHOG_HOST: 'https://eu.i.posthog.com',
    },
  };
  return {
    worker: 'booking-short-links',
    source: 'memory://booking-short-links/wrangler.jsonc',
    config: {
      name: 'nabatable-booking-short-links',
      main: 'src/index.ts',
      compatibility_date: '2026-04-11',
      d1_databases: [
        {
          binding: 'BOOKING_SHORT_LINKS_DB',
          database_name: 'nabatable-booking-short-links',
          database_id: 'prod-d1-0000-0000-0000-000000000009',
          migrations_dir: 'migrations',
        },
      ],
      kv_namespaces: [
        { binding: 'BOOKING_SHORT_LINKS_CACHE', id: 'prodkv0000000000000000000000009' },
      ],
      vars: { BOOKING_SITE_URL: 'https://nabatable.com', POSTHOG_HOST: 'https://eu.i.posthog.com' },
      ...(overrides.includeStaging === false ? {} : { env: { staging } }),
    },
  };
}

describe('deploy:validate-separation', () => {
  const tempDirs: string[] = [];
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('passes a fully separated staging config @deploy @contract', () => {
    const report = validateSeparation({
      target: 'staging',
      workers: [shortLinksConfig({})],
      environments: CONFIGURED_ENVIRONMENTS,
    });
    expect(report.findings).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.checkedFields).toBeGreaterThan(5);
    expect(report.workers).toEqual([
      { worker: 'booking-short-links', workerName: 'nabatable-booking-short-links-staging' },
    ]);
  });

  it('rejects a staging binding that inherits the production D1 id with the field path @deploy @security', () => {
    const report = validateSeparation({
      target: 'staging',
      workers: [shortLinksConfig({ stagingDatabaseId: 'prod-d1-0000-0000-0000-000000000009' })],
      environments: CONFIGURED_ENVIRONMENTS,
    });
    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        scope: 'booking-short-links',
        path: 'd1_databases[0].database_id',
        reason: 'inherited',
      }),
    );
  });

  it('rejects REPLACE_ME placeholders in the target environment @deploy @security', () => {
    const report = validateSeparation({
      target: 'staging',
      workers: [shortLinksConfig({ stagingKvId: 'REPLACE_ME_STAGING_SHORT_LINKS_KV_ID' })],
      environments: CONFIGURED_ENVIRONMENTS,
    });
    expect(report.ok).toBe(false);
    expect(report.findings).toEqual([
      expect.objectContaining({ path: 'kv_namespaces[0].id', reason: 'placeholder' }),
    ]);
  });

  it('rejects staging vars that point at a production host @deploy @security', () => {
    const report = validateSeparation({
      target: 'staging',
      workers: [shortLinksConfig({ stagingSiteUrl: 'https://app.nabatable.com' })],
      environments: CONFIGURED_ENVIRONMENTS,
    });
    expect(report.findings.map((finding) => finding.reason)).toContain('production-identity');
    expect(report.findings.some((finding) => finding.path === 'vars.BOOKING_SITE_URL')).toBe(true);
  });

  it('rejects a worker without an env.staging block @deploy', () => {
    const report = validateSeparation({
      target: 'staging',
      workers: [shortLinksConfig({ includeStaging: false })],
      environments: CONFIGURED_ENVIRONMENTS,
    });
    expect(report.findings).toEqual([
      expect.objectContaining({ path: 'env.staging', reason: 'missing-env-block' }),
    ]);
  });

  it('flags production identities leaking through process env while validating staging @deploy @security', () => {
    const report = validateSeparation({
      target: 'staging',
      workers: [shortLinksConfig({})],
      environments: CONFIGURED_ENVIRONMENTS,
      processEnv: {
        NEXT_PUBLIC_SITE_URL: 'https://nabatable.com',
        SUPABASE_URL: 'https://vrdiqfudmwydclqpydee.supabase.co',
        NEXT_PUBLIC_APP_URL: 'https://nabatable-staging-ops.vercel.app',
      },
    });
    const envFindings = report.findings.filter((finding) => finding.scope === 'process.env');
    expect(envFindings.map((finding) => finding.path).sort()).toEqual([
      'NEXT_PUBLIC_SITE_URL',
      'SUPABASE_URL',
    ]);
  });

  it('keeps vercel.json target-neutral @deploy @contract', () => {
    const neutral = checkVercelConfig({
      target: 'staging',
      environments: CONFIGURED_ENVIRONMENTS,
      vercel: {
        source: 'memory://vercel.json',
        config: { crons: [{ path: '/api/cron/process-emails', schedule: '*/5 * * * *' }] },
      },
    });
    expect(neutral.findings).toEqual([]);

    const bound = checkVercelConfig({
      target: 'staging',
      environments: CONFIGURED_ENVIRONMENTS,
      vercel: {
        source: 'memory://vercel.json',
        config: {
          alias: ['nabatable.com'],
          crons: [],
          rewrites: [{ source: '/x', destination: 'https://app.nabatable.com/x' }],
        },
      },
    });
    expect(bound.findings.map((finding) => finding.path).sort()).toEqual([
      'alias',
      'alias[0]',
      'rewrites[0].destination',
    ]);
  });

  it('validates the repository wrangler configs: staging only lacks provisioned ids, never inherits @deploy @contract', () => {
    const workers = loadWorkerConfigs(ROOT);
    expect(workers.map((entry) => entry.worker)).toEqual([
      'booking-short-links',
      'email-queue-gateway',
      'sms-summary-gateway',
      'operational-control',
    ]);
    const staging = validateSeparation({
      target: 'staging',
      workers,
      vercel: loadVercelConfig(ROOT),
      environments: CONFIGURED_ENVIRONMENTS,
    });
    const reasons = new Set(staging.findings.map((finding) => finding.reason));
    expect(reasons.has('inherited'), JSON.stringify(staging.findings, null, 2)).toBe(false);
    expect(reasons.has('production-identity'), JSON.stringify(staging.findings, null, 2)).toBe(
      false,
    );
    expect(reasons.has('missing-env-block')).toBe(false);
    // Placeholders are expected until staging resources exist; they must fail closed.
    expect(staging.ok).toBe(false);
    expect([...reasons]).toEqual(['placeholder']);

    const production = validateSeparation({
      target: 'production',
      workers,
      vercel: loadVercelConfig(ROOT),
      environments: CONFIGURED_ENVIRONMENTS,
    });
    // Customer-path Workers carry no placeholders in production.
    const customerFindings = production.findings.filter(
      (finding) => finding.scope !== 'operational-control',
    );
    expect(customerFindings, JSON.stringify(production.findings, null, 2)).toEqual([]);
    // The control-plane Worker ships with REPLACE_ME_* identifiers (GitHub ids, R2 bucket) that
    // only exist after provisioning; they must fail closed for production too, never inherit.
    const controlFindings = production.findings.filter(
      (finding) => finding.scope === 'operational-control',
    );
    expect(controlFindings.length).toBeGreaterThan(0);
    expect(new Set(controlFindings.map((finding) => finding.reason))).toEqual(
      new Set(['placeholder']),
    );
    expect(production.ok).toBe(false);
  });

  it('fails closed with the default descriptors until Vercel project ids are recorded @deploy', () => {
    const report = validateSeparation({
      target: 'staging',
      workers: [shortLinksConfig({})],
    });
    expect(report.findings).toEqual([
      expect.objectContaining({
        scope: 'environments',
        path: 'vercelProjectId',
        reason: 'placeholder',
      }),
    ]);
  });

  it('digests worker configs deterministically and independent of order @deploy', () => {
    const a = shortLinksConfig({});
    const b: WorkerConfigInput = { ...a, worker: 'sms-summary-gateway' };
    expect(digestWorkerConfigs([a, b])).toBe(digestWorkerConfigs([b, a]));
    expect(digestWorkerConfigs([a])).not.toBe(
      digestWorkerConfigs([shortLinksConfig({ stagingKvId: 'other' })]),
    );
  });

  it('strips JSONC comments and trailing commas without touching strings @deploy', () => {
    const parsed = JSON.parse(
      stripJsonComments(
        '{\n // c\n "a": "http://x/y", /* z */ "b": ["1", "2",], "c": "has // not a comment",\n}',
      ),
    ) as Record<string, unknown>;
    expect(parsed).toEqual({ a: 'http://x/y', b: ['1', '2'], c: 'has // not a comment' });
    expect(productionSection({ name: 'w', env: { staging: {} } })).toEqual({ name: 'w' });
  });

  it('main writes evidence and exits non-zero for the unprovisioned repository staging target @deploy', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'separation-'));
    tempDirs.push(dir);
    const evidencePath = path.join(dir, 'separation-staging.json');
    const code = main(
      ['--env', 'staging', '--root', ROOT, '--evidence', evidencePath, '--json'],
      {},
    );
    expect(code).toBe(1);
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as {
      kind: string;
      target: string;
      ok: boolean;
      vercelConfigDigest: string | null;
    };
    expect(evidence.kind).toBe('separation-validation');
    expect(evidence.target).toBe('staging');
    expect(evidence.ok).toBe(false);
    expect(evidence.vercelConfigDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(() => main(['--env', 'preview'], {})).toThrow(/--env must be one of/u);
  });
});
