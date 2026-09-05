import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { infraRoot } from './helpers';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function plan(args: string[]) {
  const home = mkdtempSync(path.join(tmpdir(), 'nabatable-current-builder-'));
  directories.push(home);
  return {
    home,
    result: spawnSync(
      '/bin/sh',
      [path.join(infraRoot, 'bin/build-base-image.sh'), '--plan', ...args],
      {
        encoding: 'utf8',
        env: {
          HOME: home,
          PATH: '/opt/homebrew/bin:/usr/bin:/bin',
          LIMA_HOME: '/never-touch-existing-lima',
          NABATABLE_CI_NODE_IMAGE_DIGEST: `sha256:${'a'.repeat(64)}`,
          NABATABLE_CI_REGISTRY_IMAGE_DIGEST: `sha256:${'b'.repeat(64)}`,
        },
      },
    ),
  };
}
describe('current-user golden image mode', () => {
  it('requires explicit opt-in before using the existing account', () => {
    const { result } = plan([]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('must run as the nabatable-ci service account');
  });
  it('accepts explicit current-user mode and isolates its Lima storage', () => {
    const { home, result } = plan(['--current-user']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('account mode:    current-user');
    expect(result.stdout).toContain(`${home}/nabatable-ci/lima`);
    expect(result.stdout).not.toContain('/never-touch-existing-lima');
    expect(result.stdout).not.toContain('must run as the nabatable-ci service account');
  });
});
