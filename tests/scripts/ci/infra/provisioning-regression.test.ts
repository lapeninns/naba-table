import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { infraRoot } from './helpers';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'nabatable-provisioning-'));
  roots.push(root);
  cpSync(infraRoot, path.join(root, 'infra/local-ci'), { recursive: true });
  return root;
}
function run(root: string, script: string, args: string[] = [], bin?: string) {
  return spawnSync('/bin/sh', [path.join(root, 'infra/local-ci/bin', script), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { HOME: root, PATH: `${bin ? `${bin}:` : ''}/opt/homebrew/bin:/usr/bin:/bin` },
  });
}
describe('local runner provisioning regressions', () => {
  it('runs installation preflight as the service account with its Node and pnpm PATH', () => {
    const root = fixture();
    const bin = path.join(root, 'infra/local-ci/bin');
    // Always stop at preflight. No test path can reach host installation writes.
    writeFileSync(path.join(bin, 'preflight.sh'), '#!/bin/sh\nexit 71\n');
    const id = path.join(bin, 'id');
    writeFileSync(id, '#!/bin/sh\nif [ "$1" = -u ]; then echo 0; fi\nexit 0\n');
    chmodSync(id, 0o755);
    const sudo = path.join(bin, 'sudo');
    writeFileSync(sudo, '#!/bin/sh\nprintf "%s\\n" "$@" > "$HOME/sudo.args"\nexit 71\n');
    chmodSync(sudo, 0o755);
    const result = run(root, 'install.sh', [], bin);
    expect(result.status).toBe(1);
    const args = readFileSync(path.join(root, 'sudo.args'), 'utf8').split('\n');
    expect(args.slice(0, 4)).toEqual(['-u', 'nabatable-ci', '-H', 'env']);
    expect(args[4]).toBe(
      'PATH=/opt/homebrew/opt/node@22/bin:/Users/nabatable-ci/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
    );
    expect(args.slice(5, 7)).toEqual(['sh', path.join(bin, 'preflight.sh')]);
    expect(result.stdout).not.toContain('ensuring docker context');
  });

  it('accepts concrete image settings even when documentation and rejection code mention placeholders', () => {
    const root = fixture();
    const file = path.join(root, 'infra/local-ci/lima/nabatable-ci.yaml');
    const source = readFileSync(file, 'utf8')
      .replaceAll('REPLACE_ME_UBUNTU_2404_RELEASE_DATE', '20260826')
      .replaceAll('REPLACE_ME_UBUNTU_2404_ARM64_DIGEST', 'a'.repeat(64))
      .replaceAll('REPLACE_ME_DOCKER_CE_VERSION', '29.7.2-1');
    writeFileSync(file, source);
    const result = run(root, 'build-base-image.sh', ['--plan']);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('lima/nabatable-ci.yaml still contains');
    expect(result.stdout).toContain('must run as the nabatable-ci service account');
  });
  it('still rejects an unresolved image setting', () => {
    const root = fixture();
    const file = path.join(root, 'infra/local-ci/lima/nabatable-ci.yaml');
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace(
        /digest: 'sha256:[^']+'/u,
        "digest: 'sha256:REPLACE_ME_DIGEST'",
      ),
    );
    expect(run(root, 'build-base-image.sh', ['--plan']).stdout).toContain(
      'lima/nabatable-ci.yaml still contains',
    );
  });
  it('does not treat shell rejection patterns as unresolved static configuration', () => {
    const root = fixture();
    const bin = path.join(root, 'infra/local-ci/bin');
    const lima = path.join(bin, 'limactl');
    writeFileSync(
      lima,
      '#!/bin/sh\nif [ "$1" = list ]; then echo "nabatable-ci-golden Running"; fi\n',
    );
    chmodSync(lima, 0o755);
    const result = run(root, 'sync-vm-config.sh', [], bin);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('guest configuration applied');
  });
  it('rejects unresolved proxy configuration before applying it', () => {
    const root = fixture();
    const bin = path.join(root, 'infra/local-ci/bin');
    const lima = path.join(bin, 'limactl');
    writeFileSync(
      lima,
      '#!/bin/sh\nif [ "$1" = list ]; then echo "nabatable-ci-golden Running"; fi\n',
    );
    chmodSync(lima, 0o755);
    writeFileSync(
      path.join(root, 'infra/local-ci/network/proxy/allowlist.txt'),
      'REPLACE_ME_HOST\n',
    );
    const result = run(root, 'sync-vm-config.sh', [], bin);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('contains REPLACE_ME placeholders');
  });
});
