import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const scannerPath = path.resolve('scripts/security/secret-scan.ts');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function runWithScanners(exitCode: number) {
  const directory = mkdtempSync(path.join(tmpdir(), 'secret-scan-cli-'));
  temporaryDirectories.push(directory);
  const bin = path.join(directory, 'bin');
  mkdirSync(bin);
  // Model a hosted runner login profile that resets PATH to system directories.
  writeFileSync(
    path.join(bin, 'sh'),
    '#!/bin/sh\nif [ "$1" = "-lc" ]; then PATH=/usr/bin:/bin; export PATH; fi\nexec /bin/sh "$@"\n',
  );
  chmodSync(path.join(bin, 'sh'), 0o755);
  const sensitiveOutput = 'scanner-sensitive-output-must-stay-private';
  for (const name of ['gitleaks', 'trufflehog']) {
    const file = path.join(bin, name);
    writeFileSync(
      file,
      `#!/bin/sh\necho '${sensitiveOutput}'\necho '${sensitiveOutput}' >&2\nexit ${exitCode}\n`,
    );
    chmodSync(file, 0o755);
  }
  // The scan only needs a file inventory, so no repository or external tools are contacted.
  writeFileSync(path.join(bin, 'git'), '#!/bin/sh\nexit 0\n');
  chmodSync(path.join(bin, 'git'), 0o755);
  const result = spawnSync(process.execPath, [require.resolve('tsx/cli'), scannerPath], {
    cwd: directory,
    env: {
      PATH: `${bin}${path.delimiter}/usr/bin${path.delimiter}/bin`,
      HOME: directory,
      SECRET_SCAN_ALLOW_BUILT_IN_ONLY: 'false',
    },
    encoding: 'utf8',
    timeout: 15_000,
  });
  return { ...result, sensitiveOutput, output: `${result.stdout}${result.stderr}` };
}

describe('secret scanner CLI integration', () => {
  it('discovers scanners from the job PATH without a login shell resetting it', () => {
    const result = runWithScanners(0);
    expect(result.error).toBeUndefined();
    expect(result.status, result.output).toBe(0);
    expect(result.output).not.toContain('missing required external scanner');
  });

  it('fails closed on scanner findings without printing their raw credential output', () => {
    const result = runWithScanners(1);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain('2 external scanner(s) reported findings');
    expect(result.output).not.toContain(result.sensitiveOutput);
  });
});
