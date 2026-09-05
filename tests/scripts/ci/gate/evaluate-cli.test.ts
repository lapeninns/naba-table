import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { HEAD_SHA, MERGE_SHA, repositoryRoot } from './helpers';

function runGate(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync('pnpm', ['exec', 'tsx', 'scripts/ci/gate/evaluate.ts', ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
  });
}

describe('ci:gate CLI', () => {
  it('refuses an invalid request before contacting GitHub', () => {
    const result = runGate(['--head-sha', 'abc', '--no-publish']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Release gate refused: invalid request.');
    expect(result.stderr).toContain('repositoryId must be a positive integer');
  }, 60_000);

  it('refuses without a GitHub token and repository', () => {
    const result = runGate([
      '--repository-id',
      '1',
      '--pr-number',
      '42',
      '--head-sha',
      HEAD_SHA,
      '--base-sha',
      'b'.repeat(40),
      '--tested-sha',
      MERGE_SHA,
      '--no-publish',
    ]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('GITHUB_TOKEN and GITHUB_REPOSITORY are required');
  }, 60_000);

  it('refuses an unknown mode', () => {
    const result = runGate(
      [
        '--repository-id',
        '1',
        '--head-sha',
        HEAD_SHA,
        '--base-sha',
        'b'.repeat(40),
        '--tested-sha',
        HEAD_SHA,
        '--mode',
        'yolo',
        '--no-publish',
      ],
      { GITHUB_TOKEN: 'x', GITHUB_REPOSITORY: 'a/b' },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('--mode must be merge or main-deploy');
  }, 60_000);
});
