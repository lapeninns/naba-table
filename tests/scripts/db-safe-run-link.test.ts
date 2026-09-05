import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_PRODUCTION_PROJECT_REF, DEFAULT_STAGING_PROJECT_REF } from '@/scripts/db/safety';

/**
 * `pnpm db:link` (safe-run `link`): re-links a checkout to the project that DB_TARGET_ENV names and
 * refuses unless the resulting link state proves it. Production requires CONFIRM_PRODUCTION=true.
 * The Supabase CLI is replaced by a stub that records its arguments and optionally rewrites the
 * link file, so nothing here talks to a real project.
 */

const projectRoot = path.resolve(import.meta.dirname, '../..');
const tsxExecutable = path.join(projectRoot, 'node_modules/.bin/tsx');
const temporaryDirectories: string[] = [];

type CliResult = {
  readonly status: number | null;
  readonly output: string;
  readonly calls: string[];
};

function createWorkdir(linkedProjectRef: string | null): string {
  const root = mkdtempSync(path.join(tmpdir(), 'nabatable-db-link-'));
  temporaryDirectories.push(root);
  mkdirSync(path.join(root, 'supabase', 'migrations'), { recursive: true });
  mkdirSync(path.join(root, 'supabase', '.temp'), { recursive: true });
  if (linkedProjectRef) {
    writeFileSync(path.join(root, 'supabase', '.temp', 'project-ref'), `${linkedProjectRef}\n`);
  }
  return root;
}

function runCli(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  options: { readonly linkWrites?: string } = {},
): CliResult {
  const directory = mkdtempSync(path.join(tmpdir(), 'nabatable-db-link-bin-'));
  temporaryDirectories.push(directory);
  const binDirectory = path.join(directory, 'bin');
  const logPath = path.join(directory, 'calls.log');
  mkdirSync(binDirectory);
  writeFileSync(logPath, '');
  // The stub mimics `supabase link`: when LINK_STUB_WRITES is set it records that ref in the
  // workdir named by --workdir, exactly like the real CLI rewrites supabase/.temp/project-ref.
  const supabaseStub = [
    '#!/bin/sh',
    'printf "supabase %s\\n" "$*" >> "$SAFE_RUN_TEST_LOG"',
    'workdir=""',
    'prev=""',
    'for arg in "$@"; do',
    '  if [ "$prev" = "--workdir" ]; then workdir="$arg"; fi',
    '  prev="$arg"',
    'done',
    'if [ -n "$LINK_STUB_WRITES" ] && [ -n "$workdir" ]; then',
    '  mkdir -p "$workdir/supabase/.temp"',
    '  printf "%s\\n" "$LINK_STUB_WRITES" > "$workdir/supabase/.temp/project-ref"',
    'fi',
    'exit "${SAFE_RUN_TEST_COMMAND_EXIT:-0}"',
    '',
  ].join('\n');
  writeFileSync(path.join(binDirectory, 'supabase'), supabaseStub);
  chmodSync(path.join(binDirectory, 'supabase'), 0o755);
  writeFileSync(
    path.join(binDirectory, 'pnpm'),
    '#!/bin/sh\nprintf "pnpm %s\\n" "$*" >> "$SAFE_RUN_TEST_LOG"\nexit 0\n',
  );
  chmodSync(path.join(binDirectory, 'pnpm'), 0o755);

  const result = spawnSync(tsxExecutable, ['scripts/db/safe-run.ts', ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
      SAFE_RUN_TEST_LOG: logPath,
      ...(options.linkWrites ? { LINK_STUB_WRITES: options.linkWrites } : {}),
      ...env,
    },
  });
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    calls: readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean),
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('pnpm db:link (safe-run link)', () => {
  it('prints the exact link plan for the target without spawning anything @contract', () => {
    const root = createWorkdir(DEFAULT_STAGING_PROJECT_REF);
    const whenDryRun = runCli(['link', '--dry-run'], {
      DB_TARGET_ENV: 'production',
      SUPABASE_WORKDIR: root,
    });

    expect(whenDryRun.status).toBe(0);
    expect(whenDryRun.output).toContain('target=production access=link');
    expect(whenDryRun.output).toContain(
      `guard: supabase link targets ${DEFAULT_PRODUCTION_PROJECT_REF} (production)`,
    );
    expect(whenDryRun.output).toContain(
      `workflow: supabase link --project-ref ${DEFAULT_PRODUCTION_PROJECT_REF} --workdir ${root}`,
    );
    expect(whenDryRun.calls).toEqual([]);
  });

  it('refuses to link production without CONFIRM_PRODUCTION=true and refuses replay flags @contract', () => {
    const root = createWorkdir(DEFAULT_STAGING_PROJECT_REF);
    const whenUnconfirmed = runCli(['link'], {
      DB_TARGET_ENV: 'production',
      SUPABASE_WORKDIR: root,
    });
    expect(whenUnconfirmed.status).toBe(2);
    expect(whenUnconfirmed.output).toContain(
      'CONFIRM_PRODUCTION=true is required to link the production project.',
    );
    expect(whenUnconfirmed.calls).toEqual([]);

    const whenReplayRequested = runCli(['link', '--include-all'], {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: root,
    });
    expect(whenReplayRequested.status).toBe(2);
    expect(whenReplayRequested.output).toContain('Unsupported database workflow or argument.');
    expect(whenReplayRequested.calls).toEqual([]);
  });

  it('links the production project from a staging-linked checkout and proves the new link @contract', () => {
    const root = createWorkdir(DEFAULT_STAGING_PROJECT_REF);
    const whenLinked = runCli(
      ['link'],
      {
        DB_TARGET_ENV: 'production',
        CONFIRM_PRODUCTION: 'true',
        SUPABASE_WORKDIR: root,
        SUPABASE_ACCESS_TOKEN: 'sbp_test_access_token_not_real',
        SUPABASE_DB_PASSWORD: 'deploy-secret',
      },
      { linkWrites: DEFAULT_PRODUCTION_PROJECT_REF },
    );

    expect(whenLinked.status).toBe(0);
    expect(whenLinked.calls).toEqual([
      `supabase link --project-ref ${DEFAULT_PRODUCTION_PROJECT_REF} --workdir ${root}`,
    ]);
    expect(whenLinked.output).toContain(`link: ${DEFAULT_PRODUCTION_PROJECT_REF} (production)`);
    expect(whenLinked.output).not.toContain('deploy-secret');
    expect(whenLinked.output).not.toContain('sbp_test');
    expect(readFileSync(path.join(root, 'supabase', '.temp', 'project-ref'), 'utf8').trim()).toBe(
      DEFAULT_PRODUCTION_PROJECT_REF,
    );
  });

  it('fails closed when the CLI leaves the link pointing at another project @contract', () => {
    const root = createWorkdir(DEFAULT_STAGING_PROJECT_REF);
    const whenLinkDidNotChange = runCli(['link'], {
      DB_TARGET_ENV: 'production',
      CONFIRM_PRODUCTION: 'true',
      SUPABASE_WORKDIR: root,
    });

    expect(whenLinkDidNotChange.status).toBe(2);
    expect(whenLinkDidNotChange.output).toContain(
      `Link state (${DEFAULT_STAGING_PROJECT_REF}) does not name the production project (${DEFAULT_PRODUCTION_PROJECT_REF}) after supabase link; refusing.`,
    );

    const unlinked = createWorkdir(null);
    const whenLinkIsMissing = runCli(['link'], {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: unlinked,
    });
    expect(whenLinkIsMissing.status).toBe(2);
    expect(whenLinkIsMissing.output).toContain(
      'Link state (missing) does not name the staging project',
    );
  });

  it('propagates a failing supabase link exit code before checking the link state @contract', () => {
    const root = createWorkdir(DEFAULT_STAGING_PROJECT_REF);
    const whenCliFails = runCli(['link'], {
      DB_TARGET_ENV: 'staging',
      SUPABASE_WORKDIR: root,
      SAFE_RUN_TEST_COMMAND_EXIT: '7',
    });

    expect(whenCliFails.status).toBe(7);
    expect(whenCliFails.calls).toHaveLength(1);
    expect(whenCliFails.output).not.toContain('link: ');
  });
});
