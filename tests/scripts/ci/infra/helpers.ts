import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
export const infraRoot = path.join(repositoryRoot, 'infra/local-ci');

export function readInfraFile(relativePath: string): string {
  return readFileSync(path.join(infraRoot, relativePath), 'utf8');
}

export type ShellResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

export function runShell(command: string, args: readonly string[]): ShellResult {
  const result = spawnSync(command, [...args], { cwd: repositoryRoot, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** `sh -n` / `bash -n` syntax check; returns stderr on failure. */
export function syntaxCheck(shell: 'sh' | 'bash', relativePath: string): string {
  const result = runShell(shell, ['-n', path.join(infraRoot, relativePath)]);
  return result.status === 0 ? '' : result.stderr;
}

export function nonCommentLines(content: string): readonly string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}
