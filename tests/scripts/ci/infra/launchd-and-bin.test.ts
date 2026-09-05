import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { infraRoot, readInfraFile, runShell, syntaxCheck } from './helpers';

const plist = readInfraFile('launchd/com.nabatable.ci-controller.plist');
const controller = readInfraFile('bin/controller.sh');
const install = readInfraFile('bin/install.sh');
const uninstall = readInfraFile('bin/uninstall.sh');
const preflight = readInfraFile('bin/preflight.sh');
const sync = readInfraFile('bin/sync-vm-config.sh');
const buildBaseImage = readInfraFile('bin/build-base-image.sh');

/** Minimal plist reader: value element that follows `<key>name</key>`. */
function plistValue(name: string): string | undefined {
  const match = plist.match(
    new RegExp(
      `<key>${name}</key>\\s*(<true/>|<false/>|<string>[^<]*</string>|<integer>\\d+</integer>)`,
    ),
  );
  return match?.[1];
}

const keychainItems = [
  'nabatable-ci/github-app/nabatable-local-ci/private-key',
  'nabatable-ci/monitoring/heartbeat-token',
  'nabatable-ci/r2/evidence/access-key-id',
  'nabatable-ci/r2/evidence/secret-access-key',
];

describe('infra/local-ci/launchd/com.nabatable.ci-controller.plist', () => {
  it('is a well-formed plist with the correct label, loaded only in the service account session', () => {
    expect(plist.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(plist).toContain('<plist version="1.0">');
    expect(plist.trimEnd().endsWith('</plist>')).toBe(true);
    expect(plistValue('Label')).toBe('<string>com.nabatable.ci-controller</string>');
    // A per-user LaunchAgent: no UserName/GroupName (those are daemon keys),
    // restricted to the GUI session where the login Keychain is unlocked.
    expect(plist).not.toContain('<key>UserName</key>');
    expect(plist).not.toContain('<key>GroupName</key>');
    expect(plistValue('LimitLoadToSessionType')).toBe('<string>Aqua</string>');
    expect(plist).toContain('/Users/nabatable-ci/Library/LaunchAgents');
  });

  it('runs at load and is kept alive', () => {
    expect(plistValue('RunAtLoad')).toBe('<true/>');
    expect(plistValue('KeepAlive')).toBe('<true/>');
    expect(plistValue('ThrottleInterval')).toBe('<integer>30</integer>');
    expect(plistValue('ExitTimeOut')).toBe('<integer>120</integer>');
  });

  it('runs the wrapper script, not pnpm directly, and forwards no secrets', () => {
    const programArguments = plist.slice(
      plist.indexOf('<key>ProgramArguments</key>'),
      plist.indexOf('</array>'),
    );
    expect(programArguments).toContain(
      '/Users/nabatable-ci/nabatable-ci/current/infra/local-ci/bin/controller.sh',
    );
    expect(programArguments).not.toContain('pnpm');
    const environment = plist.slice(
      plist.indexOf('<key>EnvironmentVariables</key>'),
      plist.indexOf('<key>LimitLoadToSessionType</key>'),
    );
    expect(environment).not.toMatch(/TOKEN|SECRET|KEY|PASSWORD/);
    expect(environment).not.toContain('<key>PATH</key>');
  });

  it('writes logs under the service account home', () => {
    expect(plistValue('StandardOutPath')).toContain(
      '/Users/nabatable-ci/Library/Logs/nabatable-ci/',
    );
    expect(plistValue('StandardErrorPath')).toContain(
      '/Users/nabatable-ci/Library/Logs/nabatable-ci/',
    );
  });

  it('passes plutil -lint when the tool is available', () => {
    const which = runShell('sh', ['-c', 'command -v plutil']);
    if (which.status !== 0) return;
    const lint = runShell('plutil', [
      '-lint',
      path.join(infraRoot, 'launchd/com.nabatable.ci-controller.plist'),
    ]);
    expect(lint.status, lint.stderr).toBe(0);
  });
});

describe('infra/local-ci/bin/*.sh', () => {
  it('are valid POSIX sh (macOS bash 3.2 compatible)', () => {
    for (const script of [
      'bin/controller.sh',
      'bin/install.sh',
      'bin/uninstall.sh',
      'bin/preflight.sh',
      'bin/sync-vm-config.sh',
      'bin/render-lima.sh',
      'bin/vm-mode.sh',
      'bin/build-base-image.sh',
    ]) {
      expect(syntaxCheck('sh', script), script).toBe('');
    }
  });

  it('controller.sh execs pnpm ci:controller from a fixed PATH and refuses secrets in the env file', () => {
    expect(controller).toContain('exec pnpm ci:controller');
    expect(controller).toMatch(/^export PATH="[^"]+"$/m);
    expect(controller).toContain('export PATH="/opt/homebrew/opt/node@22/bin:$HOME/.local/bin:');
    expect(controller).toContain('die "$config_file must not contain secrets; use Keychain items"');
    expect(controller).toContain('REPLACE_ME');
    expect(controller).toContain('[ "$(id -un)" = \'nabatable-ci\' ]');
  });

  it('controller.sh reads only the App key value (into a 0600 file) and existence-checks the rest', () => {
    const readValueUses = controller
      .split('\n')
      .filter((line) => /find-generic-password[^\n]*\s-w(\s|$)/.test(line));
    expect(readValueUses).toHaveLength(1);
    expect(readValueUses[0]).toContain('-s "$KC_APP_KEY" -a "$KC_ACCOUNT" -w >"$pem.tmp"');
    expect(controller).toContain('chmod 700 "$run_dir"');
    expect(controller).toContain('chmod 600 "$pem"');
    expect(controller).toContain('export NABATABLE_LOCAL_CI_PRIVATE_KEY_PATH="$pem"');
    expect(controller).toContain('umask 077');
    // Existence checks carry no -w and discard output.
    expect(controller).toContain(
      'security find-generic-password -s "$item" -a "$KC_ACCOUNT" >/dev/null 2>&1',
    );
    // The secret never reaches a log/echo/printf or a command substitution.
    expect(controller).not.toMatch(/cat "\$pem/);
    expect(controller).not.toMatch(/\$\(security/);
  });

  it('controller.sh resolves the VM mode and proxy URL from operating.json and exports the Keychain settings the controller reads', () => {
    expect(controller).toContain('infra/local-ci/bin/vm-mode.sh" "$vm_mode"');
    expect(controller).toContain('"egressProxyUrl"');
    expect(controller).toContain('export NABATABLE_CI_KEYCHAIN_ACCOUNT="$KC_ACCOUNT"');
    expect(controller).toContain('export NABATABLE_CI_HEARTBEAT_KEYCHAIN_SERVICE="$KC_HEARTBEAT"');
    expect(controller).toContain('export NABATABLE_CI_HEARTBEAT_KEYCHAIN_ACCOUNT="$KC_ACCOUNT"');
  });

  it('controller.sh, install.sh, and uninstall.sh agree on the Keychain item names', () => {
    for (const item of keychainItems) {
      expect(controller).toContain(`'${item}'`);
      expect(install).toContain(`-s '${item}' -a '$account' -w`);
      expect(uninstall).toContain(`-s '${item}' -a 'nabatable-ci'`);
    }
    expect(controller).toContain("KC_ACCOUNT='nabatable-ci'");
  });

  it('install/uninstall/preflight/sync never touch the default Docker context or stop containers', () => {
    for (const script of [install, uninstall, preflight, sync]) {
      expect(script).not.toMatch(/docker context use/);
      expect(script).not.toMatch(/docker context rm[^\n]*(default|desktop-linux)/);
      expect(script).not.toMatch(/docker (stop|kill|rm|system prune|container)/);
      expect(script).not.toMatch(/limactl (stop|delete)[^\n]*(default|docker)\b/);
    }
    expect(uninstall).toContain('docker context rm -f nabatable-ci');
    expect(install).toContain('docker context create nabatable-ci');
    expect(buildBaseImage).not.toMatch(/docker context/);
  });

  it('install.sh is idempotent and installs a LaunchAgent into the service account session', () => {
    expect(install).toContain('cmp -s "$plist_src" "$plist_dst"');
    expect(install).toContain('docker context inspect nabatable-ci >/dev/null 2>&1');
    expect(install).toContain('if [ ! -f "$config" ]; then');
    expect(install).toContain('plist_dst="${home_dir}/Library/LaunchAgents/${label}.plist"');
    expect(install).toContain('launchctl print "gui/${uid}/${label}"');
    expect(install).toContain('launchctl bootstrap "gui/${uid}" "$plist_dst"');
    expect(install).not.toMatch(/launchctl bootstrap system/);
    expect(install).toContain('sysadminctl -addUser');
    expect(install).toContain('sh "$here/preflight.sh"');
  });

  it('install.sh writes a config template that uses the controller/executor variable names with placeholders only', () => {
    const template = install.slice(install.indexOf("<<'ENV'"), install.indexOf('\nENV\n'));
    for (const name of [
      'NABATABLE_LOCAL_CI_APP_ID',
      'NABATABLE_LOCAL_CI_INSTALLATION_ID',
      'NABATABLE_CI_REPOSITORY',
      'NABATABLE_CI_REPOSITORY_ID',
      'NABATABLE_CI_SOURCE_REMOTE_URL',
      'NABATABLE_CI_POLICY_VERSION',
      'NABATABLE_CI_BASE_IMAGE_PATH',
      'NABATABLE_CI_BASE_IMAGE_DIGEST',
      'NABATABLE_CI_JOB_IMAGE',
      'NABATABLE_CI_IMAGE_DIGEST',
      'NABATABLE_CI_R2_ENDPOINT',
      'NABATABLE_CI_R2_BUCKET',
      'NABATABLE_CI_HEARTBEAT_URL',
      'NABATABLE_CI_SPOOL_ROOT',
      'NABATABLE_CI_JOB_ROOT',
      'NABATABLE_CI_VM_MODE',
    ]) {
      expect(template, name).toMatch(new RegExp(`^${name}=`, 'm'));
    }
    const assignments = template
      .split('\n')
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => line.split('=').slice(1).join('='));
    for (const value of assignments) {
      // Every ID/digest/URL is an explicit placeholder or a local path/mode; never a real-looking secret.
      expect(value).toMatch(/REPLACE_ME|^\/Users\/nabatable-ci\/|^normal$/);
    }
    expect(template).not.toMatch(/TOKEN=|SECRET=|PRIVATE_KEY/);
    // The request tuple digest is the job image digest, not the golden disk digest.
    expect(template).toContain(
      'NABATABLE_CI_JOB_IMAGE=ci-registry.local/nabatable/ci-job@sha256:REPLACE_ME_JOB_IMAGE_DIGEST',
    );
    expect(template).toContain('NABATABLE_CI_IMAGE_DIGEST=sha256:REPLACE_ME_JOB_IMAGE_DIGEST');
  });

  it('preflight checks limactl, docker context, AC power, and 100GiB free disk', () => {
    expect(preflight).toContain('command -v limactl');
    expect(preflight).toContain('command -v qemu-img');
    expect(preflight).toContain('docker context inspect nabatable-ci');
    expect(preflight).toContain("grep -q 'AC Power'");
    expect(preflight).toContain('-ge 100');
    expect(preflight).toContain('fdesetup status');
    expect(preflight).toContain('scutil --nc list');
    expect(preflight).toContain('(- location:|digest:|DOCKER_CE_VERSION=).*REPLACE_ME');
  });

  it('sync-vm-config.sh refuses placeholders, only targets golden instances, and uses limactl copy (no mounts)', () => {
    expect(sync).toContain("grep -q 'REPLACE_ME'");
    expect(sync).toContain('limactl copy');
    expect(sync).not.toContain('--mount');
    expect(sync).toContain('/etc/nabatable-ci/network/setup.sh');
    expect(sync).toContain('nabatable-ci-golden | nabatable-ci-golden-*) ;;');
  });
});

describe('infra/local-ci/bin/build-base-image.sh', () => {
  const script = path.join(infraRoot, 'bin/build-base-image.sh');

  it('refuses to build while placeholders remain and the environment is unconfigured', () => {
    const result = runShell('sh', [script]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('refusing to build');
    expect(result.stderr).toContain('NABATABLE_CI_NODE_IMAGE_DIGEST');
    expect(result.stderr).toContain('NABATABLE_CI_REGISTRY_IMAGE_DIGEST');
  });

  it('prints the plan without executing anything and lists why a real run would refuse', () => {
    const result = runShell('sh', [script, '--plan', '--mode', 'dedicated']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('nothing executed');
    expect(result.stdout).toContain('mode=dedicated');
    expect(result.stdout).toContain('limactl create --tty=false --name=nabatable-ci-golden');
    expect(result.stdout).toContain('bin/sync-vm-config.sh nabatable-ci-golden');
    expect(result.stdout).toContain('ci-registry.local');
    expect(result.stdout).toContain('qemu-img convert -O qcow2');
    expect(result.stdout).toContain('NABATABLE_CI_IMAGE_DIGEST = job image digest');
    expect(result.stdout).toContain('UNCONFIGURED: a real run would refuse because:');
    expect(result.stdout).not.toContain('lima/nabatable-ci.yaml still contains');
  });

  it('rejects unknown modes and flags', () => {
    expect(runShell('sh', [script, '--mode', 'huge']).status).toBe(2);
    expect(runShell('sh', [script, '--bogus']).status).toBe(2);
  });

  it('builds the job image only inside the guest, through the job proxy, with digest pins', () => {
    expect(buildBaseImage).toContain('limactl shell "$golden" -- sudo sh -c');
    expect(buildBaseImage).toContain('docker build --network=nabatable-ci-jobs');
    expect(buildBaseImage).toContain('--build-arg HTTPS_PROXY=http://10.90.0.1:8888');
    expect(buildBaseImage).toContain("--build-arg NODE_IMAGE_DIGEST='${node_digest}'");
    expect(buildBaseImage).toContain("'registry@${registry_digest}'");
    expect(buildBaseImage).toContain('--env REGISTRY_HTTP_ADDR=127.0.0.1:80');
    expect(buildBaseImage).toContain('shasum -a 256');
    expect(buildBaseImage).toContain('job_digest=${job_image#*@}');
    expect(buildBaseImage).toContain('NABATABLE_CI_IMAGE_DIGEST=$job_digest');
    expect(buildBaseImage).toContain('NABATABLE_CI_JOB_IMAGE=$job_image');
    expect(buildBaseImage).toContain('NABATABLE_CI_BASE_IMAGE_DIGEST=sha256:$digest');
    expect(buildBaseImage).not.toMatch(/^docker build/m);
    expect(buildBaseImage).not.toMatch(/:latest/);
  });
});
