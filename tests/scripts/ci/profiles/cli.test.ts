import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  EXIT_INPUT,
  EXIT_OK,
  EXIT_USAGE,
  parseChangedPaths,
  runProfileCli,
} from '@/scripts/ci/profiles/cli';
import { prProfile } from '@/scripts/ci/profiles/pr';

const projectRoot = path.resolve(import.meta.dirname, '../../../..');
const temporaryDirectories: string[] = [];

interface Capture {
  readonly stdout: string[];
  readonly stderr: string[];
  readonly files: Readonly<Record<string, string>>;
}

function run(
  argv: readonly string[],
  files: Readonly<Record<string, string>> = {},
): Capture & { code: number } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = runProfileCli(argv, {
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
    readFile: (filePath) => {
      const content = files[filePath];
      if (content === undefined) {
        throw new Error(`ENOENT: ${filePath}`);
      }
      return content;
    },
  });
  return { code, stdout, stderr, files };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('ci:profile cli', () => {
  it('prints the resolved pr profile as text', () => {
    const result = run(['pr']);
    expect(result.code).toBe(EXIT_OK);
    expect(result.stderr).toEqual([]);
    expect(result.stdout[0]).toBe('Profile: pr (policy 2026-09-04.1, schema v1)');
    expect(result.stdout.join('\n')).toContain('Image: UNCONFIGURED');
    expect(result.stdout.join('\n')).toContain(
      'not provided (conditional suites run; fail closed)',
    );
    expect(result.stdout.join('\n')).toContain(
      `Commands (${prProfile.suites.reduce((total, suite) => total + suite.commandIds.length, 0)}):`,
    );
    expect(result.stdout.join('\n')).toContain('[run ] shuffle-seed-20260715');
  });

  it('applies conditional rules from a changed-paths file and emits json', () => {
    const result = run(['pr', '--json', '--changed-paths', 'changed.txt'], {
      'changed.txt': '# changed files\nsrc/app/page.tsx\n\nserver/x.ts\n',
    });
    expect(result.code).toBe(EXIT_OK);
    const parsed = JSON.parse(result.stdout.join('\n')) as {
      name: string;
      changedPathsProvided: boolean;
      suites: Array<{ suiteId: string; included: boolean }>;
      commands: Array<{ run: string }>;
    };
    expect(parsed.name).toBe('pr');
    expect(parsed.changedPathsProvided).toBe(true);
    expect(parsed.suites.filter((suite) => !suite.included).map((suite) => suite.suiteId)).toEqual([
      'shuffle-seed-20260715',
      'shuffle-seed-20260716',
      'shuffle-seed-20260717',
    ]);
    expect(parsed.commands.some((command) => command.run.includes('test:stability'))).toBe(false);

    const testChanging = run(['pr', '--json', '--changed-paths', 'changed.txt'], {
      'changed.txt': 'tests/server/a.test.ts\n',
    });
    const parsedTestChanging = JSON.parse(testChanging.stdout.join('\n')) as typeof parsed;
    expect(parsedTestChanging.suites.every((suite) => suite.included)).toBe(true);
  });

  it('exits non-zero on unknown profiles, bad options, and missing files', () => {
    expect(run(['release']).code).toBe(EXIT_USAGE);
    expect(run(['release']).stderr.join('\n')).toContain('unknown profile "release"');
    expect(run([]).code).toBe(EXIT_USAGE);
    expect(run(['pr', '--verbose']).code).toBe(EXIT_USAGE);
    expect(run(['pr', '--changed-paths']).code).toBe(EXIT_USAGE);
    expect(run(['pr', 'main']).code).toBe(EXIT_USAGE);
    const missing = run(['pr', '--changed-paths', 'nope.txt']);
    expect(missing.code).toBe(EXIT_INPUT);
    expect(missing.stderr.join('\n')).toContain('nope.txt');
  });

  it('parses changed path files leniently', () => {
    expect(parseChangedPaths(' a.ts \r\n# comment\n\nb/c.tsx\n')).toEqual(['a.ts', 'b/c.tsx']);
  });

  it('runs end to end through tsx', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'nabatable-ci-profile-'));
    temporaryDirectories.push(directory);
    const changedPaths = path.join(directory, 'changed.txt');
    writeFileSync(changedPaths, 'README.md\n');
    const tsx = path.join(projectRoot, 'node_modules/.bin/tsx');
    const ok = spawnSync(
      tsx,
      ['scripts/ci/profiles/cli.ts', 'main', '--json', '--changed-paths', changedPaths],
      {
        cwd: projectRoot,
        encoding: 'utf8',
      },
    );
    expect(ok.status).toBe(0);
    const parsed = JSON.parse(ok.stdout) as { name: string; commands: unknown[] };
    expect(parsed.name).toBe('main');
    expect(parsed.commands).toHaveLength(
      prProfile.suites.reduce((total, suite) => total + suite.commandIds.length, 0),
    );

    const bad = spawnSync(tsx, ['scripts/ci/profiles/cli.ts', 'weekly'], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('unknown profile');
  }, 60_000);
});
