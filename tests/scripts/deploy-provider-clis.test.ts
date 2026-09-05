import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { CommandNotFoundError, spawnCommandRunner } from '@/scripts/deploy/exec';
import {
  DEFAULT_PROVIDER_CLI_PINS_PATH,
  PROVIDER_CLI_NAMES,
  ProviderCliError,
  assertProviderCli,
  loadProviderCliPins,
  parseCliVersion,
  parseProviderCliPins,
} from '@/scripts/deploy/provider-clis';

import type { CommandRunner } from '@/scripts/deploy/exec';

const ROOT = process.cwd();
const SEMVER = /^\d+\.\d+\.\d+$/u;
const SHA_PIN = /^supabase\/setup-cli@[0-9a-f]{40}$/u;

type Step = {
  readonly name?: string;
  readonly id?: string;
  readonly uses?: string;
  readonly run?: string;
  readonly with?: Record<string, unknown>;
  readonly env?: Record<string, unknown>;
};
type Workflow = { readonly jobs: Record<string, { readonly steps: Step[] }> };

function loadDeployWorkflow(): Workflow {
  return parse(
    readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8'),
  ) as Workflow;
}

function versionRunner(versions: Partial<Record<string, string>>): {
  runner: CommandRunner;
  calls: string[][];
} {
  const calls: string[][] = [];
  const runner: CommandRunner = (command, args) => {
    calls.push([command, ...args]);
    const version = versions[command];
    if (!version) return { status: 1, stdout: '', stderr: 'boom' };
    return {
      status: 0,
      stdout: command === 'vercel' ? `Vercel CLI ${version}\n${version}\n` : `${version}\n`,
      stderr: '',
    };
  };
  return { runner, calls };
}

describe('deploy provider CLI pins', () => {
  const tempDirs: string[] = [];
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('pins every provider CLI to an exact semver version @deploy @contract', () => {
    const pins = loadProviderCliPins();
    expect(DEFAULT_PROVIDER_CLI_PINS_PATH).toBe(
      path.join(ROOT, 'scripts', 'deploy', 'provider-clis.json'),
    );
    for (const name of PROVIDER_CLI_NAMES) {
      expect(pins[name]).toMatch(SEMVER);
    }
    expect(() => parseProviderCliPins({ vercel: { version: '1.2.3' } })).toThrow(ProviderCliError);
    expect(() =>
      parseProviderCliPins({ vercel: { version: '^1.2.3' }, supabase: { version: '2.0.0' } }),
    ).toThrow(/exact semver/u);
    expect(() =>
      parseProviderCliPins({
        vercel: { version: 'REPLACE_ME_VERCEL_CLI' },
        supabase: { version: '2.0.0' },
      }),
    ).toThrow(ProviderCliError);
    expect(() => parseProviderCliPins(null)).toThrow(ProviderCliError);
    expect(parseCliVersion('Vercel CLI 59.11.7\n59.11.7')).toBe('59.11.7');
    expect(parseCliVersion('2.116.0')).toBe('2.116.0');
    expect(parseCliVersion('no version here')).toBeNull();
  });

  it('accepts a CLI whose --version matches the pin and refuses drift or failure @deploy @security', () => {
    const pins = loadProviderCliPins();
    const ok = versionRunner({ vercel: pins.vercel, supabase: pins.supabase });
    expect(assertProviderCli({ cli: 'vercel', runner: ok.runner })).toEqual({
      name: 'vercel',
      version: pins.vercel,
    });
    expect(assertProviderCli({ cli: 'supabase', runner: ok.runner })).toEqual({
      name: 'supabase',
      version: pins.supabase,
    });
    expect(ok.calls).toEqual([
      ['vercel', '--version'],
      ['supabase', '--version'],
    ]);

    const drifted = versionRunner({ vercel: '0.0.1' });
    expect(() => assertProviderCli({ cli: 'vercel', runner: drifted.runner })).toThrow(
      /pins .* install the pinned version/u,
    );
    expect(() => assertProviderCli({ cli: 'supabase', runner: drifted.runner })).toThrow(
      /without a version/u,
    );

    const dir = mkdtempSync(path.join(os.tmpdir(), 'provider-clis-'));
    tempDirs.push(dir);
    const pinsPath = path.join(dir, 'provider-clis.json');
    writeFileSync(pinsPath, JSON.stringify({ vercel: { version: 'latest' } }));
    expect(() => assertProviderCli({ cli: 'vercel', runner: ok.runner, pinsPath })).toThrow(
      ProviderCliError,
    );
    expect(() => loadProviderCliPins(path.join(dir, 'missing.json'))).toThrow(/could not be read/u);
  });

  it('reports a missing binary as command-not-found instead of a null exit status @deploy', () => {
    expect(() => spawnCommandRunner('nabatable-definitely-missing-cli', ['--version'])).toThrow(
      CommandNotFoundError,
    );
    expect(() => spawnCommandRunner('nabatable-definitely-missing-cli', ['--version'])).toThrow(
      /command not found on PATH/u,
    );
  });

  it('deploy.yml installs the pinned vercel and supabase CLIs before any provider call in both delivery jobs @deploy @contract', () => {
    const workflow = loadDeployWorkflow();
    const pinsSource = readFileSync(DEFAULT_PROVIDER_CLI_PINS_PATH, 'utf8');
    expect(JSON.parse(pinsSource)).toMatchObject({
      vercel: { version: loadProviderCliPins().vercel },
    });

    for (const jobId of ['staging', 'production']) {
      const steps = workflow.jobs[jobId]?.steps ?? [];
      const names = steps.map((step) => step.name ?? step.uses ?? step.run ?? '');
      const indexOf = (predicate: (step: Step) => boolean) => steps.findIndex(predicate);

      const resolve = indexOf((step) => step.id === 'provider_clis');
      expect(resolve, `${jobId}: resolve step`).toBeGreaterThan(-1);
      expect(steps[resolve]?.run).toContain(
        "jq -r '.vercel.version' scripts/deploy/provider-clis.json",
      );
      expect(steps[resolve]?.run).toContain(
        "jq -r '.supabase.version' scripts/deploy/provider-clis.json",
      );

      const supabase = indexOf((step) => (step.uses ?? '').startsWith('supabase/setup-cli@'));
      expect(supabase, `${jobId}: supabase/setup-cli step`).toBeGreaterThan(resolve);
      expect(steps[supabase]?.uses).toMatch(SHA_PIN);
      expect(steps[supabase]?.with?.version).toBe('${{ steps.provider_clis.outputs.supabase }}');

      const vercel = indexOf((step) => (step.run ?? '').includes('npm install -g "vercel@'));
      expect(vercel, `${jobId}: vercel install step`).toBeGreaterThan(resolve);
      expect(steps[vercel]?.env?.VERCEL_CLI_VERSION).toBe(
        '${{ steps.provider_clis.outputs.vercel }}',
      );
      expect(steps[vercel]?.run).not.toMatch(/\$\{\{/u);

      const verify = indexOf((step) =>
        (step.run ?? '').includes('pnpm exec tsx scripts/deploy/provider-clis.ts vercel supabase'),
      );
      expect(verify, `${jobId}: verify step`).toBeGreaterThan(Math.max(supabase, vercel));

      const firstProviderCall = indexOf((step) =>
        /pnpm (db:(link|plan-remote|migrate|sql-regression)|deploy:vercel:(prebuilt|promote))/u.test(
          step.run ?? '',
        ),
      );
      expect(
        firstProviderCall,
        `${jobId}: first provider call (${names.join(' | ')})`,
      ).toBeGreaterThan(verify);
    }
  });

  it('deploy.yml provides a readiness origin for every worker deployed by deploy:workers @deploy @contract', () => {
    const workflow = loadDeployWorkflow();
    for (const [jobId, prefix] of [
      ['staging', 'STAGING'],
      ['production', 'PRODUCTION'],
    ] as const) {
      const steps = workflow.jobs[jobId]?.steps ?? [];
      const deploy = steps.find((step) => (step.run ?? '').includes('pnpm deploy:workers'));
      expect(deploy, `${jobId}: Deploy Workers step`).toBeDefined();
      const workers = /for worker in ([^;]+);/u
        .exec(deploy?.run ?? '')?.[1]
        ?.trim()
        .split(/\s+/u);
      expect(workers).toEqual([
        'booking-short-links',
        'email-queue-gateway',
        'sms-summary-gateway',
        'operational-control',
      ]);
      expect(deploy?.run).toContain(`--env ${jobId}`);
      // Workers without a public base URL var in wrangler.jsonc need WORKER_URL_<NAME>.
      expect(deploy?.env?.WORKER_URL_EMAIL_QUEUE_GATEWAY).toBe(
        `\${{ vars.${prefix}_EMAIL_QUEUE_GATEWAY_URL }}`,
      );
      expect(deploy?.env?.WORKER_URL_OPERATIONAL_CONTROL).toBe(
        `\${{ vars.${prefix}_OPERATIONAL_CONTROL_URL }}`,
      );
      expect(deploy?.env?.MONITORING_TOKEN).toBe('${{ secrets.MONITORING_TOKEN }}');
    }
  });
});
