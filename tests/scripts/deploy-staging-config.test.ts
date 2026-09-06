import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { ENVIRONMENTS } from '@/scripts/deploy/environments';
import {
  ProductionHostError,
  assertNotProductionTarget,
  isProductionHostname,
  requireStagingUrl,
} from '@/scripts/deploy/staging-hosts';
import {
  DEPLOYABLE_WORKERS,
  environmentSection,
  flattenLeaves,
  readWranglerConfig,
  productionSection,
  wranglerConfigPath,
} from '@/scripts/deploy/wrangler-config';
import { STAGING_REQUIRED_ENV, resolveStagingEnv } from '@/tests/e2e/staging/env';

const SHA = 'a'.repeat(40);

const validEnv: NodeJS.ProcessEnv = {
  STAGING_PUBLIC_URL: 'https://nabatable-staging.vercel.app',
  STAGING_OPS_URL: 'https://nabatable-staging-ops.vercel.app',
  MONITORING_TOKEN: 'fake-monitoring-token',
  NABATABLE_SOURCE_REVISION: SHA,
  STAGING_SYNTHETIC_TENANT_ID: '11111111-1111-4111-8111-111111111111',
  STAGING_SYNTHETIC_TENANT_SLUG: 'synthetic-tenant-a',
  STAGING_SYNTHETIC_TENANT_B_ID: '22222222-2222-4222-8222-222222222222',
  STAGING_SYNTHETIC_TENANT_B_SLUG: 'synthetic-tenant-b',
  STAGING_SYNTHETIC_GUEST_EMAIL: 'synthetic-guest@example.com',
  STAGING_SYNTHETIC_GUEST_PHONE: '+447700900000',
};

describe('playwright.staging.config guard', () => {
  it('throws when STAGING_PUBLIC_URL names a production host, even before other checks @staging @security', () => {
    for (const host of [
      'https://nabatable.com',
      'https://www.nabatable.com/',
      'https://app.nabatable.com',
      'https://go.nabatable.com',
      'https://nabatable.vercel.app',
      'https://anything.nabatable.com',
    ]) {
      expect(() => resolveStagingEnv({ STAGING_PUBLIC_URL: host })).toThrow(ProductionHostError);
      expect(() => resolveStagingEnv({ ...validEnv, STAGING_PUBLIC_URL: host })).toThrow(
        /production host/u,
      );
    }
    expect(() =>
      resolveStagingEnv({ ...validEnv, STAGING_OPS_URL: 'https://app.nabatable.com' }),
    ).toThrow(ProductionHostError);
  });

  it('accepts staging hosts and returns normalized origins @staging', () => {
    const resolved = resolveStagingEnv({
      ...validEnv,
      STAGING_PUBLIC_URL: 'https://nabatable-staging.vercel.app/some/path',
      STAGING_OPS_URL: 'https://staging-ops.nabatable.com',
    });
    expect(resolved.publicUrl).toBe('https://nabatable-staging.vercel.app');
    expect(resolved.opsUrl).toBe('https://staging-ops.nabatable.com');
    expect(resolved.expectedRevision).toBe(SHA);
    expect(resolved.tenantA.slug).toBe('synthetic-tenant-a');
    expect(resolved.optional.STAGING_SHORT_LINKS_URL).toBeUndefined();
  });

  it('requires MONITORING_TOKEN and every STAGING_SYNTHETIC_* input by name @staging', () => {
    const {
      MONITORING_TOKEN: _token,
      STAGING_SYNTHETIC_TENANT_B_SLUG: _slug,
      ...partial
    } = validEnv;
    void _token;
    void _slug;
    expect(() => resolveStagingEnv(partial)).toThrow(
      /Staging proofs require env: MONITORING_TOKEN, STAGING_SYNTHETIC_TENANT_B_SLUG/u,
    );
    expect(STAGING_REQUIRED_ENV).toContain('MONITORING_TOKEN');
    expect(
      STAGING_REQUIRED_ENV.filter((name) => name.startsWith('STAGING_SYNTHETIC_')),
    ).toHaveLength(6);
  });

  it('rejects non-https URLs, malformed revisions and real guest inboxes @staging @security', () => {
    expect(() =>
      resolveStagingEnv({ ...validEnv, STAGING_PUBLIC_URL: 'http://staging.example' }),
    ).toThrow(/https/u);
    expect(() => resolveStagingEnv({ ...validEnv, NABATABLE_SOURCE_REVISION: 'main' })).toThrow(
      /40-hex/u,
    );
    expect(() =>
      resolveStagingEnv({ ...validEnv, STAGING_SYNTHETIC_GUEST_EMAIL: 'someone@gmail.com' }),
    ).toThrow(/reserved test domain/u);
    expect(() =>
      resolveStagingEnv({
        ...validEnv,
        STAGING_SUPABASE_URL: 'https://vrdiqfudmwydclqpydee.supabase.co',
      }),
    ).toThrow(ProductionHostError);
  });

  it('classifies hostnames: staging subdomains pass, everything else on the apex is production @staging', () => {
    expect(isProductionHostname('staging.nabatable.com')).toBe(false);
    expect(isProductionHostname('staging-ops.nabatable.com')).toBe(false);
    expect(isProductionHostname('nabatable-staging.vercel.app')).toBe(false);
    expect(isProductionHostname('NABATABLE.COM.')).toBe(true);
    expect(isProductionHostname('api.nabatable.com')).toBe(true);
    expect(isProductionHostname('vrdiqfudmwydclqpydee.supabase.co')).toBe(true);
    expect(isProductionHostname('')).toBe(false);
    expect(assertNotProductionTarget('X', ' https://nabatable-staging.vercel.app ')).toBe(
      'https://nabatable-staging.vercel.app',
    );
    expect(() => requireStagingUrl({}, 'STAGING_PUBLIC_URL')).toThrow(/required/u);
  });

  it('config file has no webServer, no retries and a single worker @staging @contract', () => {
    // Compare code only: the header comment documents the same guarantees in prose.
    const source = readFileSync('playwright.staging.config.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/\/\/.*$/gmu, '');
    expect(source).not.toMatch(/webServer/u);
    expect(source).toMatch(/retries:\s*0/u);
    expect(source).toMatch(/workers:\s*1/u);
    expect(source).toMatch(/forbidOnly:\s*true/u);
    expect(source).toMatch(/testDir:\s*'\.\/tests\/e2e\/staging'/u);
    expect(source).not.toMatch(/qa-|fixture|mock/iu);
  });
});

describe('staging web host topology', () => {
  const stagingWebHosts = new Set(
    [ENVIRONMENTS.staging.publicUrl, ENVIRONMENTS.staging.opsUrl].map(
      (url) => new URL(url).hostname,
    ),
  );
  /** Hosts that belong to the web deployment family: the Vercel aliases and anything on the apex. */
  const isWebFamilyHost = (hostname: string): boolean =>
    hostname.endsWith('.vercel.app') || hostname.endsWith('.nabatable.com');

  function stagingVarHosts(worker: (typeof DEPLOYABLE_WORKERS)[number]): string[] {
    const config = readWranglerConfig(wranglerConfigPath(process.cwd(), worker));
    const staging = environmentSection(config, 'staging');
    if (!staging) throw new Error(`${worker}: missing env.staging`);
    const hosts: string[] = [];
    for (const leaf of flattenLeaves(staging.vars ?? {}, 'vars')) {
      if (typeof leaf.value !== 'string') continue;
      if (leaf.path === 'vars.TARGETS_JSON') {
        const targets = JSON.parse(leaf.value) as Array<{ name: string; url: string }>;
        for (const target of targets) {
          if (target.name === 'web') hosts.push(new URL(target.url).hostname);
        }
        continue;
      }
      for (const url of leaf.value.match(/https:\/\/[^\s",]+/gu) ?? []) {
        hosts.push(new URL(url).hostname);
      }
      // Bare comma-separated host lists (e.g. ALLOWED_DESTINATION_HOSTS).
      for (const token of leaf.value.split(',')) {
        if (/^[a-z0-9.-]+\.[a-z]{2,}$/u.test(token.trim())) hosts.push(token.trim());
      }
    }
    return hosts;
  }

  it('resolves every staging web URL across Workers and descriptors to the same host set @staging @contract', () => {
    expect(stagingWebHosts).toEqual(
      new Set(['nabatable-staging.vercel.app', 'nabatable-staging-ops.vercel.app']),
    );
    for (const worker of DEPLOYABLE_WORKERS) {
      const webHosts = stagingVarHosts(worker).filter(isWebFamilyHost);
      for (const host of webHosts) {
        expect(stagingWebHosts, `${worker} env.staging points at ${host}`).toContain(host);
      }
    }
  });

  it('enables qualified observation only in the production configuration selected by deploy:workers @staging @contract', () => {
    const config = readWranglerConfig(wranglerConfigPath(process.cwd(), 'operational-control'));
    const production = productionSection(config).vars as Record<string, unknown>;
    const productionMirror = environmentSection(config, 'production')?.vars as Record<
      string,
      unknown
    >;
    const staging = environmentSection(config, 'staging')?.vars as Record<string, unknown>;
    expect(production.POST_DEPLOY_OBSERVER_ENABLED).toBe('true');
    expect(production.DEPLOYMENT_ENVIRONMENT).toBe('production');
    expect(productionMirror.POST_DEPLOY_OBSERVER_ENABLED).toBe('true');
    expect(productionMirror.DEPLOYMENT_ENVIRONMENT).toBe('production');
    expect(staging.POST_DEPLOY_OBSERVER_ENABLED).toBe('false');
    expect(staging.DEPLOYMENT_ENVIRONMENT).toBe('staging');
  });

  it('probes the staging web readiness endpoint and posts error insight on the staging web hosts @staging @contract', () => {
    const config = readWranglerConfig(wranglerConfigPath(process.cwd(), 'operational-control'));
    const staging = environmentSection(config, 'staging');
    const vars = (staging?.vars ?? {}) as Record<string, string>;
    const targets = JSON.parse(vars.TARGETS_JSON) as Array<{ name: string; url: string }>;
    expect(targets.find((target) => target.name === 'web')?.url).toBe(
      `${ENVIRONMENTS.staging.publicUrl}/api/ready`,
    );
    expect(vars.ERROR_INSIGHT_WEBHOOK_URL).toBe(
      `${ENVIRONMENTS.staging.opsUrl}/api/webhook/error-insight`,
    );
  });
});
