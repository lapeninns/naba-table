import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(path.resolve('infra/local-ci/actions/proof-admission.sh'), 'utf8');
function admission(overrides: Record<string, string> = {}, fork = false) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'actions-admission-'));
  try {
    const expected = {
      repositoryId: 42,
      actorId: 23,
      sha: 'a'.repeat(40),
      workflowRef: 'example/private/.github/workflows/proof.yml@refs/heads/proof',
    };
    const config = path.join(dir, 'expected.json');
    const event = path.join(dir, 'event.json');
    writeFileSync(config, JSON.stringify(expected));
    writeFileSync(
      event,
      JSON.stringify({ repository: { id: 42, fork }, after: expected.sha, deleted: false }),
    );
    return spawnSync('bash', ['-s'], {
      input: source.replace('/etc/nabatable-ci/actions-proof.json', config),
      env: {
        PATH: process.env.PATH,
        GITHUB_EVENT_PATH: event,
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REPOSITORY_ID: '42',
        GITHUB_ACTOR_ID: '23',
        GITHUB_SHA: expected.sha,
        GITHUB_WORKFLOW_REF: expected.workflowRef,
        ...overrides,
      },
      encoding: 'utf8',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
describe('Actions proof admission hook', () => {
  it('admits the exact trusted push tuple', () => expect(admission().status).toBe(0));
  it.each([
    { GITHUB_EVENT_NAME: 'pull_request' },
    { GITHUB_REPOSITORY_ID: '99' },
    { GITHUB_ACTOR_ID: '99' },
    { GITHUB_SHA: 'b'.repeat(40) },
    { GITHUB_WORKFLOW_REF: 'example/private/.github/workflows/other.yml@refs/heads/proof' },
    { GITHUB_EVENT_PATH: '/missing-event' },
  ])('refuses mismatched job context %j', (overrides) => {
    expect(admission(overrides).status).toBe(1);
  });
  it('refuses a fork even if all environment identifiers match', () => {
    expect(admission({}, true).status).toBe(1);
  });
});
