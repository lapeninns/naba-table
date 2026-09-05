import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { readInfraFile, repositoryRoot } from './helpers';

type OperatingConfig = {
  readonly version: number;
  readonly policySource: { readonly path: string; readonly owner: string; readonly schema: string };
  readonly window: Record<string, string>;
  readonly allocations: {
    readonly source: string;
    readonly vmModeByWindow: Record<string, string>;
  };
  readonly runtime: {
    readonly activeRuntime: string;
    readonly candidateRuntime: string;
    readonly qualificationNote: string;
  };
  readonly vm: {
    readonly goldenName: string;
    readonly jobInstancePrefix: string;
    readonly template: string;
    readonly disk: string;
    readonly modes: Record<string, { readonly cpus: number; readonly memory: string }>;
    readonly modeEnv: Record<string, string>;
    readonly baseImageEnv: Record<string, string>;
    readonly hostFilesystemShared: boolean;
    readonly hostPortsForwarded: boolean;
    readonly dockerContext: string;
    readonly dockerContextProtectedNames: readonly string[];
    readonly guestSpoolDir: string;
  };
  readonly job: {
    readonly image: {
      readonly repository: string;
      readonly localRegistryAlias: string;
      readonly imageEnv: string;
      readonly requestTupleDigestEnv: string;
      readonly uid: number;
    };
    readonly seccompProfile: string;
    readonly guestPaths: Record<string, string>;
    readonly network: {
      readonly jobNetwork: {
        readonly name: string;
        readonly subnet: string;
        readonly bridge: string;
        readonly internal: boolean;
      };
      readonly containerPool: string;
      readonly proxy: { readonly jobFacingAddress: string; readonly port: number };
      readonly egressProxyUrl: string;
      readonly phases: readonly string[];
    };
  };
  readonly controller: {
    readonly launchdLabel: string;
    readonly launchdKind: string;
    readonly serviceAccount: string;
    readonly command: string;
    readonly keychainAccount: string;
    readonly keychainItems: Record<string, string>;
    readonly keychainEnv: Record<string, string>;
    readonly privateKeyPathEnv: string;
  };
};

const raw = readInfraFile('operating.json');
const operating = JSON.parse(raw) as OperatingConfig;
const controllerScript = readInfraFile('bin/controller.sh');
const installScript = readInfraFile('bin/install.sh');
const tinyproxy = readInfraFile('network/proxy/tinyproxy.conf');
const egress = readInfraFile('network/egress.sh');
const setup = readInfraFile('network/setup.sh');
const plist = readInfraFile('launchd/com.nabatable.ci-controller.plist');

const readRepoFile = (relativePath: string): string =>
  readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
const policy = JSON.parse(readRepoFile('config/ci/operating-config.json')) as Record<
  string,
  unknown
>;
const controllerMain = readRepoFile('scripts/ci/controller/main.ts');
const executorConfig = readRepoFile('scripts/ci/executor/config.ts');

/** Resolve `<file>#/a/b` against the parsed policy file; undefined when the path is missing. */
function resolvePointer(source: string): unknown {
  const [file, fragment] = source.split('#');
  expect(file).toBe(operating.policySource.path);
  let cursor: unknown = policy;
  for (const segment of (fragment ?? '').split('/').filter(Boolean)) {
    if (typeof cursor !== 'object' || cursor === null) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/** Dotted paths the executor's loadOperatingFacts reads (`dig(raw, '<path>')`). */
function executorFactPaths(): readonly string[] {
  return [...executorConfig.matchAll(/dig(?:String|Number)?\(raw, '([a-zA-Z.]+)'/g)].map(
    (match) => match[1],
  );
}

function dig(value: unknown, dotted: string): unknown {
  let cursor: unknown = value;
  for (const segment of dotted.split('.')) {
    if (typeof cursor !== 'object' || cursor === null) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

describe('infra/local-ci/operating.json', () => {
  it('points at the controller-owned policy with pointers that resolve, instead of duplicating it', () => {
    expect(operating.policySource.path).toBe('config/ci/operating-config.json');
    expect(operating.policySource.owner).toBe('scripts/ci/controller');
    expect(operating.policySource.schema).toBe('scripts/ci/contracts/operating-config.ts');
    for (const source of [
      operating.window.source,
      operating.window.nightlySource,
      operating.window.timezoneSource,
      operating.allocations.source,
    ]) {
      expect(resolvePointer(source), `${source} must resolve in the policy file`).toBeDefined();
    }
    for (const key of Object.keys(operating.window)) {
      expect(['source', 'nightlySource', 'timezoneSource', 'vmSideBehaviour']).toContain(key);
    }
    // No literal schedule/policy values may leak in: only pointers and behaviour notes.
    for (const forbidden of [
      '"dedicatedWindow": {',
      '"start"',
      '"end"',
      '"timezone"',
      '"minFreeGiB"',
      '"ciCapGiB"',
      '"intervalSeconds"',
      '"alertAfterMinutes"',
      '"eligibilityAfterMinutes"',
      'Europe/London',
      '00:30',
    ]) {
      expect(raw, forbidden).not.toContain(forbidden);
    }
  });

  it('records node22 active and node24 candidate with a qualification note', () => {
    expect(operating.runtime.activeRuntime).toBe('node22');
    expect(operating.runtime.candidateRuntime).toBe('node24');
    expect(operating.runtime.qualificationNote.length).toBeGreaterThan(40);
  });

  it('satisfies every operating-fact path the executor reads', () => {
    const paths = executorFactPaths();
    expect(paths.length).toBeGreaterThan(5);
    for (const dotted of paths) {
      const value = dig(operating, dotted);
      expect(value, `${dotted} must exist for scripts/ci/executor/config.ts`).toBeDefined();
      if (Array.isArray(value)) {
        expect(value.length, `${dotted} non-empty array`).toBeGreaterThan(0);
      } else if (typeof value === 'number') {
        expect(Number.isSafeInteger(value) && value > 0, `${dotted} positive integer`).toBe(true);
      } else {
        expect(typeof value === 'string' && value.length > 0, `${dotted} non-empty string`).toBe(
          true,
        );
      }
    }
    expect(executorConfig).toContain("dig(raw, 'vm.dockerContextProtectedNames')");
    expect(operating.vm.dockerContextProtectedNames).toContain('default');
    expect(operating.vm.dockerContextProtectedNames).not.toContain(operating.vm.dockerContext);
  });

  it('describes the VM shape consistently with the executor', () => {
    expect(operating.vm.goldenName).toBe('nabatable-ci-golden');
    expect(operating.vm.jobInstancePrefix).toBe('nabatable-ci');
    expect(executorConfig).toContain(`'${operating.vm.jobInstancePrefix}',`);
    expect(operating.vm.template).toBe('infra/local-ci/lima/nabatable-ci.yaml');
    expect(operating.vm.hostFilesystemShared).toBe(false);
    expect(operating.vm.hostPortsForwarded).toBe(false);
    expect(operating.vm.dockerContext).toBe('nabatable-ci');
    expect(Object.keys(operating.vm.modes).sort()).toEqual(['dedicated', 'normal']);
    expect(
      Object.values(operating.allocations.vmModeByWindow).every(
        (mode) => mode in operating.vm.modes,
      ),
    ).toBe(true);
    expect(executorConfig).toContain(`guestSpoolDir: '${operating.vm.guestSpoolDir}'`);
    for (const envName of [
      ...Object.values(operating.vm.modeEnv),
      ...Object.values(operating.vm.baseImageEnv),
      operating.job.image.imageEnv,
    ]) {
      expect(executorConfig, envName).toContain(`'${envName}'`);
    }
    // The controller stamps the request tuple digest from this variable and
    // also accepts the job image reference to cross-check it.
    expect(controllerMain).toContain(`'${operating.job.image.requestTupleDigestEnv}'`);
    expect(controllerMain).toContain(`'${operating.job.image.imageEnv}'`);
  });

  it('keeps the modes, disk, and proxy URL on their own prettier-formatted lines for the shell readers', () => {
    expect(raw).toMatch(/^\s*"normal": \{ "cpus": 6, "memory": "16GiB" \},?$/m);
    expect(raw).toMatch(/^\s*"dedicated": \{ "cpus": 10, "memory": "24GiB" \},?$/m);
    expect(raw).toMatch(/^\s*"disk": "120GiB",?$/m);
    expect(raw).toMatch(/^\s*"egressProxyUrl": "http:\/\/10\.90\.0\.1:8888",?$/m);
  });

  it('matches the guest network and proxy configuration', () => {
    const { network } = operating.job;
    expect(network.jobNetwork).toEqual({
      name: 'nabatable-ci-jobs',
      subnet: '10.90.0.0/24',
      bridge: 'nbci-jobs',
      internal: true,
    });
    expect(network.proxy).toEqual({ jobFacingAddress: '10.90.0.1', port: 8888 });
    expect(network.egressProxyUrl).toBe(
      `http://${network.proxy.jobFacingAddress}:${network.proxy.port}`,
    );
    expect(network.phases).toEqual(['prep', 'test']);
    expect(tinyproxy).toContain(`Listen ${network.proxy.jobFacingAddress}`);
    expect(tinyproxy).toContain(`Port ${network.proxy.port}`);
    expect(tinyproxy).toContain(`Allow ${network.jobNetwork.subnet}`);
    expect(egress).toContain(`JOB_GATEWAY='${network.proxy.jobFacingAddress}'`);
    expect(egress).toContain(`PROXY_PORT='${network.proxy.port}'`);
    expect(egress).toContain(`JOB_SUBNET='${network.jobNetwork.subnet}'`);
    expect(egress).toContain(`DOCKER_POOL='${network.containerPool}'`);
    expect(setup).toContain(`JOB_NETWORK='${network.jobNetwork.name}'`);
    expect(setup).toContain(`bridge.name=${network.jobNetwork.bridge}`);
    expect(operating.job.seccompProfile).toBe('infra/local-ci/seccomp/ci-job.json');
    expect(executorConfig).toContain(`'${operating.job.seccompProfile}'`);
    expect(operating.job.guestPaths.egressScript).toBe('/etc/nabatable-ci/network/egress.sh');
    expect(operating.job.image.repository).toBe(
      `${operating.job.image.localRegistryAlias}/nabatable/ci-job`,
    );
  });

  it('matches the launchd and Keychain contract used by controller.sh, install.sh and the CI code', () => {
    expect(operating.controller.launchdLabel).toBe('com.nabatable.ci-controller');
    expect(operating.controller.launchdKind).toBe('LaunchAgent');
    expect(plist).toContain(`<string>${operating.controller.launchdLabel}</string>`);
    expect(operating.controller.serviceAccount).toBe('nabatable-ci');
    expect(operating.controller.command).toBe('pnpm ci:controller');
    expect(operating.controller.keychainAccount).toBe('nabatable-ci');
    // The executor's default Keychain account must be the one the items are created under.
    expect(executorConfig).toContain(
      `'NABATABLE_CI_KEYCHAIN_ACCOUNT',\n    'keychainAccount',\n    '${operating.controller.keychainAccount}'`,
    );
    const items = operating.controller.keychainItems;
    expect(Object.keys(items).sort()).toEqual([
      'githubAppPrivateKey',
      'heartbeatToken',
      'r2EvidenceAccessKeyId',
      'r2EvidenceSecretAccessKey',
    ]);
    for (const item of Object.values(items)) {
      expect(item).toMatch(/^nabatable-ci\/[a-z0-9/-]+$/);
      expect(controllerScript).toContain(`'${item}'`);
      expect(installScript).toContain(`-s '${item}' -a '$account' -w`);
    }
    expect(controllerScript).toContain(`KC_ACCOUNT='${operating.controller.keychainAccount}'`);
    // The controller's built-in defaults are the same account and heartbeat
    // item, so a missing export can never silently point at a different entry.
    expect(controllerMain).toContain(`'${operating.controller.keychainAccount}'`);
    expect(controllerMain).toContain(`'${items.heartbeatToken}'`);
    // The controller reads these env names; the wrapper exports them with the
    // item names above, and writes the App key to the path variable.
    for (const envName of [
      ...Object.values(operating.controller.keychainEnv),
      operating.controller.privateKeyPathEnv,
    ]) {
      expect(controllerMain, envName).toContain(`'${envName}'`);
      expect(controllerScript, envName).toContain(`export ${envName}=`);
    }
  });
});
