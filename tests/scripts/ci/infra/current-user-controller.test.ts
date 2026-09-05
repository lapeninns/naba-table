import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { infraRoot } from './helpers';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'nabatable-current-controller-'));
  roots.push(root);
  mkdirSync(path.join(root, 'current'));
  mkdirSync(path.join(root, 'config'));
  writeFileSync(path.join(root, 'current/package.json'), '{}');
  writeFileSync(
    path.join(root, 'config/controller.env'),
    'if [ -n "${UNRELATED_TEST_CREDENTIAL:-}" ]; then exit 41; fi\necho CLEAN_ENV_CONFIRMED\nexit 42\n',
  );
  return root;
}
function run(root: string, owner: string) {
  return spawnSync('/bin/sh', [path.join(infraRoot, 'bin/controller.sh')], {
    encoding: 'utf8',
    env: {
      HOME: process.env.HOME,
      PATH: '/usr/bin:/bin',
      NABATABLE_CI_HOME: root,
      NABATABLE_CI_ACCOUNT_MODE: 'current-user',
      NABATABLE_CI_OWNER_UID: owner,
      UNRELATED_TEST_CREDENTIAL: 'synthetic-host-only-value',
    },
  });
}
describe('current-user controller startup', () => {
  it('rejects a different owner before loading configuration', () => {
    const result = run(fixture(), String((process.getuid?.() ?? 0) + 1));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('current-user owner UID does not match');
    expect(result.stdout).not.toContain('CLEAN_ENV_CONFIRMED');
  });
  it('clears unrelated host credentials before configuration is loaded', () => {
    const result = run(fixture(), String(process.getuid?.() ?? 0));
    if (process.getuid?.() === 0) {
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('must not run as root');
    } else {
      expect(result.status, result.stderr).toBe(42);
      expect(result.stdout).toContain('CLEAN_ENV_CONFIRMED');
    }
  });
});
