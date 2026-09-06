import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workerDir = path.join(repositoryRoot, 'cloudflare/operational-control');

const SECRET_NAMES = [
  'GITHUB_WEBHOOK_SECRET',
  'GITHUB_DISPATCH_APP_ID',
  'GITHUB_DISPATCH_APP_PRIVATE_KEY',
  'GITHUB_DISPATCH_INSTALLATION_ID',
  'HEARTBEAT_TOKEN',
  'MONITORING_TOKEN',
  'UPTIME_HEARTBEAT_URL',
];
const REQUIRED_VARS = [
  'REPOSITORY_ID',
  'LOCAL_CI_APP_ID',
  'GATE_WORKFLOW_ID',
  'FALLBACK_WORKFLOW_ID',
  'SCHEDULED_VALIDATION_WORKFLOW_ID',
  'PROTECTED_REF',
  'TARGETS_JSON',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripJsonComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
    .replace(/,(\s*[}\]])/gu, '$1');
}

function readJson(relativePath: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(
    stripJsonComments(readFileSync(path.join(workerDir, relativePath), 'utf8')),
  );
  if (!isRecord(parsed)) throw new Error(`${relativePath} must be an object.`);
  return parsed;
}

function section(config: Record<string, unknown>, name: 'staging' | 'production') {
  const env = isRecord(config.env) ? config.env : {};
  const value = env[name];
  if (!isRecord(value)) throw new Error(`env.${name} missing`);
  return value;
}

describe('operational-control wrangler contract', () => {
  const config = readJson('wrangler.jsonc');
  const environments = [config, section(config, 'staging'), section(config, 'production')];

  it('names the Worker, enables authenticated workers.dev endpoints and exposes version metadata', () => {
    expect(config.name).toBe('nabatable-operational-control');
    expect(config.main).toBe('src/index.ts');
    expect(config.version_metadata).toEqual({ binding: 'CF_VERSION_METADATA' });
    expect(section(config, 'staging').name).toBe('nabatable-operational-control-staging');
    expect(section(config, 'production').name).toBe('nabatable-operational-control');
    for (const environment of environments) {
      expect(environment.workers_dev).toBe(true);
      expect(environment.observability).toEqual({
        enabled: true,
        logs: { invocation_logs: false },
      });
      expect(environment.triggers).toEqual({ crons: ['*/5 * * * *'] });
    }
  });

  it('routes readiness probes through public Worker routes in every deployment environment', () => {
    for (const environment of environments) {
      expect(environment.compatibility_flags).toContain('global_fetch_strictly_public');
      expect(environment.compatibility_flags).not.toContain('global_fetch_private_origin');
    }
  });

  it('binds the SQLite Durable Object and an R2 evidence bucket in every environment', () => {
    expect(config.migrations).toEqual([{ tag: 'v1', new_sqlite_classes: ['Coordinator'] }]);
    const buckets = new Set<string>();
    for (const environment of environments) {
      expect(environment.durable_objects).toEqual({
        bindings: [{ name: 'COORDINATOR', class_name: 'Coordinator' }],
      });
      const r2 = environment.r2_buckets;
      expect(Array.isArray(r2) && r2.length === 1).toBe(true);
      const [bucket] = r2 as Record<string, unknown>[];
      expect(bucket?.binding).toBe('EVIDENCE_BUCKET');
      expect(typeof bucket?.bucket_name).toBe('string');
      expect(bucket?.bucket_name).toMatch(
        /^nabatable-(?:operational-evidence|ci-evidence-staging)$/u,
      );
      buckets.add(String(bucket?.bucket_name));
    }
    expect(buckets).toEqual(
      new Set(['nabatable-operational-evidence', 'nabatable-ci-evidence-staging']),
    );
    expect(config.r2_buckets).toEqual(section(config, 'production').r2_buckets);
    expect(config.r2_buckets).not.toEqual(section(config, 'staging').r2_buckets);
  });

  it('declares configured numeric control-plane identities and never places secrets in vars', () => {
    for (const environment of environments) {
      const vars = isRecord(environment.vars) ? environment.vars : {};
      for (const name of REQUIRED_VARS) expect(Object.keys(vars)).toContain(name);
      for (const name of SECRET_NAMES) expect(Object.keys(vars)).not.toContain(name);
      expect(vars.PROTECTED_REF).toBe('refs/heads/main');
      for (const name of REQUIRED_VARS.filter(
        (key) => key !== 'PROTECTED_REF' && key !== 'TARGETS_JSON',
      )) {
        expect(vars[name]).toMatch(/^[1-9][0-9]*$/u);
      }
    }
  });

  it('lists the web app and the three customer Workers as readiness targets per environment', () => {
    for (const name of ['staging', 'production'] as const) {
      const vars = section(config, name).vars as Record<string, unknown>;
      const targets: unknown = JSON.parse(String(vars.TARGETS_JSON));
      expect(Array.isArray(targets)).toBe(true);
      const entries = targets as Record<string, unknown>[];
      expect(entries.map((entry) => entry.name)).toEqual([
        'web',
        'booking-short-links',
        'email-queue-gateway',
        'sms-summary-gateway',
      ]);
      for (const entry of entries) {
        expect(entry.environment).toBe(name);
        expect(String(entry.url)).toMatch(/^https:\/\//u);
        expect(String(entry.url)).toMatch(/\/ready$/u);
      }
    }
  });
});

describe('operational-control package contract', () => {
  it('mirrors the booking-short-links toolchain exactly', () => {
    const pkg = readJson('package.json');
    const reference = JSON.parse(
      readFileSync(
        path.join(repositoryRoot, 'cloudflare/booking-short-links/package.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(pkg.name).toBe('@nabatable/operational-control');
    expect(pkg.private).toBe(true);
    expect(pkg.devDependencies).toEqual(reference.devDependencies);
    const scripts = isRecord(pkg.scripts) ? pkg.scripts : {};
    for (const name of [
      'build',
      'dev',
      'lint',
      'test',
      'test:ci',
      'test:coverage',
      'typecheck',
      'verify',
    ]) {
      expect(typeof scripts[name]).toBe('string');
    }
    expect(scripts.dev).toContain('--port 8790');
  });

  it('documents every route in openapi.yaml with responses', () => {
    const document = parseYaml(
      readFileSync(path.join(workerDir, 'openapi.yaml'), 'utf8'),
    ) as Record<string, unknown>;
    expect(document.openapi).toBe('3.1.0');
    const paths = isRecord(document.paths) ? document.paths : {};
    expect(Object.keys(paths).sort()).toEqual([
      '/deployment-verification',
      '/github/webhook',
      '/health',
      '/heartbeat',
      '/incidents/{incidentId}/acknowledge',
      '/ready',
    ]);
    const observation = paths['/deployment-verification'];
    expect(isRecord(observation) && Object.keys(observation)).toEqual(['get']);
    const get = isRecord(observation) && isRecord(observation.get) ? observation.get : {};
    expect(get.security).toEqual([{ monitoringBearer: [] }]);
    expect(Object.keys(get.responses as Record<string, unknown>).sort()).toEqual([
      '200',
      '401',
      '503',
    ]);
    for (const item of Object.values(paths)) {
      if (!isRecord(item)) continue;
      for (const operation of Object.values(item)) {
        if (!isRecord(operation)) continue;
        expect(Object.keys(operation.responses as Record<string, unknown>).length).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it('documents the deploy command and every secret in the README', () => {
    const readme = readFileSync(path.join(workerDir, 'README.md'), 'utf8');
    expect(readme).toContain('pnpm deploy:workers --worker operational-control --env');
    for (const name of SECRET_NAMES) expect(readme).toContain(name);
    expect(readme).toContain('activeRuntime: node22');
    expect(readme).toContain('candidateRuntime: node24');
  });
});
