import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const fixtures: string[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

function fixture(homeName = 'Home with spaces') {
  const base = mkdtempSync(path.join(tmpdir(), 'nabatable-current-user-'));
  fixtures.push(base);
  const home = path.join(base, homeName);
  const bin = path.join(base, 'bin');
  const root = path.join(base, 'source');
  mkdirSync(home);
  mkdirSync(bin);
  mkdirSync(path.join(root, 'infra/local-ci/bin'), { recursive: true });
  cpSync('infra/local-ci/bin/install.sh', path.join(root, 'infra/local-ci/bin/install.sh'));
  cpSync('infra/local-ci/bin/uninstall.sh', path.join(root, 'infra/local-ci/bin/uninstall.sh'));
  cpSync('infra/local-ci/launchd', path.join(root, 'infra/local-ci/launchd'), { recursive: true });
  writeFileSync(path.join(root, 'infra/local-ci/bin/preflight.sh'), '#!/bin/sh\nexit 0\n');
  const log = path.join(base, 'calls');
  const tool = (name: string, body: string) => {
    writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`);
    chmodSync(path.join(bin, name), 0o755);
  };
  tool('sudo', 'echo "unexpected sudo" >&2; exit 99');
  tool(
    'docker',
    'printf "docker %s DOCKER_CONFIG=%s\\n" "$*" "$DOCKER_CONFIG" >> "$CALL_LOG"; case "$*" in "context inspect nabatable-ci") exit 1;; esac',
  );
  tool('launchctl', 'printf "launchctl %s\\n" "$*" >> "$CALL_LOG"; exit 0');
  tool(
    'limactl',
    'printf "limactl %s LIMA_HOME=%s\\n" "$*" "$LIMA_HOME" >> "$CALL_LOG"; if [ "$1" = list ]; then printf "nabatable-ci-golden\\npersonal-vm\\n"; fi',
  );
  // plutil's edit invocation is asserted without using a host LaunchAgent or launchd.
  tool('plutil', 'printf "plutil %s\\n" "$*" >> "$CALL_LOG"; exit 0');
  symlinkSync(process.execPath, path.join(bin, 'node'));
  const ci = path.join(home, 'nabatable-ci');
  const release = path.join(ci, 'releases', 'reviewed');
  mkdirSync(path.join(release, 'infra/local-ci/bin'), { recursive: true });
  writeFileSync(path.join(release, 'package.json'), '{}');
  writeFileSync(path.join(release, 'infra/local-ci/bin/controller.sh'), '#!/bin/sh\n');
  symlinkSync(release, path.join(ci, 'current'));
  const run = (script: string, args: string[] = [], extraEnv: Record<string, string> = {}) =>
    spawnSync('/bin/sh', [path.join(root, 'infra/local-ci/bin', script), ...args], {
      cwd: root,
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home, CALL_LOG: log, ...extraEnv },
      encoding: 'utf8',
    });
  return { home, ci, run, log, bin, tool };
}

describe('current-user install opt-in', () => {
  it('stages private current-user assets without sudo or starting launchd', () => {
    const f = fixture();
    const result = f.run('install.sh', ['--current-user', '--no-start']);
    expect(result.status, result.stderr + result.stdout).toBe(0);
    expect(statSync(f.ci).mode & 0o777).toBe(0o700);
    expect(readFileSync(path.join(f.ci, 'config/controller.env'), 'utf8')).toContain(f.ci);
    const calls = readFileSync(f.log, 'utf8');
    expect(calls).toContain('NABATABLE_CI_ACCOUNT_MODE');
    expect(calls).toContain('NABATABLE_CI_OWNER_UID');
    expect(calls).toContain(`LIMA_HOME -string ${f.ci}/lima`);
    expect(calls).toContain('RunAtLoad -bool false');
    expect(calls).not.toContain('bootstrap');
    expect(calls).not.toContain('bootout');
    expect(calls).not.toContain('kickstart');
    expect(result.stdout).not.toContain('/Users/nabatable-ci');
  });

  it('reloads an already registered agent so activation picks up KeepAlive settings', () => {
    const f = fixture();
    const staged = f.run('install.sh', ['--current-user', '--no-start']);
    expect(staged.status, staged.stderr).toBe(0);
    const activated = f.run('install.sh', ['--current-user']);
    expect(activated.status, activated.stderr).toBe(0);
    const calls = readFileSync(f.log, 'utf8');
    const uid = process.getuid?.();
    const bootout = `launchctl bootout gui/${uid}/com.nabatable.ci-controller`;
    const bootstrap = `launchctl bootstrap gui/${uid} ${f.home}/Library/LaunchAgents/com.nabatable.ci-controller.plist`;
    expect(calls).toContain(bootout);
    expect(calls).toContain(bootstrap);
    expect(calls.indexOf(bootout)).toBeLessThan(calls.indexOf(bootstrap));
    expect(calls).not.toContain('kickstart');
  });

  it.runIf(process.platform === 'darwin')(
    'renders a real valid plist and quotes shell config paths safely',
    () => {
      const f = fixture("Home & apostrophe's space");
      rmSync(path.join(f.bin, 'plutil'));
      const result = f.run('install.sh', ['--current-user', '--no-start']);
      expect(result.status, result.stderr + result.stdout).toBe(0);
      const plist = path.join(f.home, 'Library/LaunchAgents/com.nabatable.ci-controller.plist');
      const read = (key: string) =>
        spawnSync('/usr/bin/plutil', ['-extract', key, 'raw', plist], {
          encoding: 'utf8',
        }).stdout.trim();
      expect(read('EnvironmentVariables.HOME')).toBe(f.home);
      expect(read('EnvironmentVariables.DOCKER_CONFIG')).toBe(path.join(f.ci, 'docker'));
      expect(read('EnvironmentVariables.LIMA_HOME')).toBe(path.join(f.ci, 'lima'));
      expect(read('EnvironmentVariables.NABATABLE_CI_ACCOUNT_MODE')).toBe('current-user');
      expect(read('EnvironmentVariables.NABATABLE_CI_OWNER_UID')).toBe(String(process.getuid?.()));
      expect(read('RunAtLoad')).toBe('false');
      expect(read('KeepAlive')).toBe('false');
      const parsed = spawnSync(
        '/bin/sh',
        [
          '-c',
          '. "$1"; printf "%s" "$NABATABLE_CI_JOB_ROOT"',
          'read-config',
          path.join(f.ci, 'config/controller.env'),
        ],
        { env: {}, encoding: 'utf8' },
      );
      expect(parsed.status, parsed.stderr).toBe(0);
      expect(parsed.stdout).toBe(path.join(f.ci, 'jobs'));
    },
  );

  it('deletes only prefixed CI VMs from its isolated Lima directory when explicitly requested', () => {
    const f = fixture();
    mkdirSync(path.join(f.ci, 'lima'));
    const result = f.run('uninstall.sh', ['--current-user', '--delete-vm']);
    expect(result.status, result.stderr).toBe(0);
    const calls = readFileSync(f.log, 'utf8');
    expect(calls).toContain(`limactl delete --force nabatable-ci-golden LIMA_HOME=${f.ci}/lima`);
    expect(calls).not.toContain('delete --force personal-vm');
    expect(calls).toContain(`DOCKER_CONFIG=${f.ci}/docker`);
  });

  it('keeps the dedicated account default requiring sudo', () => {
    const f = fixture();
    const result = f.run('install.sh');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('sudo');
    expect(existsSync(f.log)).toBe(false);
  });

  it('rejects root in current-user mode before touching assets', () => {
    const f = fixture();
    f.tool('id', 'case "$1" in -u) echo 0;; -un) echo root;; esac');
    const result = f.run('install.sh', ['--current-user']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('root');
    expect(existsSync(f.log)).toBe(false);
  });

  it('requires an existing reviewed current symlink', () => {
    const f = fixture();
    rmSync(path.join(f.ci, 'current'));
    const result = f.run('install.sh', ['--current-user', '--no-start']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('current');
    expect(existsSync(f.log)).toBe(false);
  });

  it('rejects CI paths redirected outside the current account assets', () => {
    const f = fixture();
    symlinkSync(tmpdir(), path.join(f.ci, 'config'));
    const result = f.run('install.sh', ['--current-user', '--no-start']);
    expect(result.status).toBe(1);
    expect(existsSync(f.log)).toBe(false);
  });

  it('uninstalls only its own agent and context while leaving credentials and config', () => {
    const f = fixture();
    mkdirSync(path.join(f.home, 'Library/LaunchAgents'), { recursive: true });
    writeFileSync(
      path.join(f.home, 'Library/LaunchAgents/com.nabatable.ci-controller.plist'),
      'fixture',
    );
    mkdirSync(path.join(f.ci, 'run'));
    writeFileSync(path.join(f.ci, 'run/github-app.pem'), 'synthetic-key');
    const result = f.run('uninstall.sh', ['--current-user']);
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(path.join(f.ci, 'run/github-app.pem'))).toBe(true);
    expect(readFileSync(f.log, 'utf8')).not.toContain('limactl');
    expect(readFileSync(f.log, 'utf8')).not.toContain('default');
  });
});
