import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseArgs, readStopSignal } from '@/scripts/ci/executor/main';
import { CiRequestError } from '@/scripts/ci/executor/request';

import { cleanupTempDirs, mainRequest, makeTempDir } from './helpers';

vi.hoisted(() => {
  process.env.NABATABLE_CI_EXECUTOR_NO_MAIN = '1';
});

afterEach(cleanupTempDirs);

describe('parseArgs', () => {
  it('parses an inline request and flags', () => {
    const args = parseArgs(
      ['--request', JSON.stringify(mainRequest()), '--dry-run', '--json'],
      '/cwd',
    );
    expect(args.request).toEqual(mainRequest());
    expect(args.dryRun).toBe(true);
    expect(args.json).toBe(true);
    expect(args.repoRoot).toBe('/cwd');
    expect(args.controlFile).toBeNull();
    expect(args.resultFile).toBeNull();
  });

  it('parses the controller file contract', () => {
    const dir = makeTempDir();
    const requestFile = path.join(dir, 'request.json');
    writeFileSync(
      requestFile,
      JSON.stringify({
        request: mainRequest(),
        mode: 'normal',
        allocation: { cpus: 4, memoryGiB: 8 },
      }),
    );
    const args = parseArgs(
      [
        '--request-file',
        requestFile,
        '--control-file',
        'control.json',
        '--result-file',
        'out/result.json',
      ],
      dir,
    );
    expect(args.request).toEqual({
      request: mainRequest(),
      mode: 'normal',
      allocation: { cpus: 4, memoryGiB: 8 },
    });
    expect(args.controlFile).toBe(path.join(dir, 'control.json'));
    expect(args.resultFile).toBe(path.join(dir, 'out', 'result.json'));
  });

  it('reads the controller side-channel files from the environment', () => {
    const dir = makeTempDir();
    const requestFile = path.join(dir, 'request.json');
    const allocationFile = path.join(dir, 'allocation.json');
    const controlFile = path.join(dir, 'control.json');
    writeFileSync(requestFile, JSON.stringify(mainRequest()));
    writeFileSync(
      allocationFile,
      JSON.stringify({ mode: 'dedicated', allocation: { cpus: 10, memoryGiB: 24 } }),
    );
    const args = parseArgs(['--request', `@${requestFile}`, '--json'], dir, {
      NABATABLE_CI_CONTROL_FILE: controlFile,
      NABATABLE_CI_ALLOCATION_FILE: allocationFile,
    });
    expect(args.controlFile).toBe(controlFile);
    expect(args.request).toEqual({
      request: mainRequest(),
      mode: 'dedicated',
      allocation: { cpus: 10, memoryGiB: 24 },
    });
  });

  it('prefers explicit --control-file, ignores a missing allocation file and rejects a broken one', () => {
    const dir = makeTempDir();
    const explicit = path.join(dir, 'explicit.json');
    const args = parseArgs(
      ['--request', JSON.stringify(mainRequest()), '--control-file', explicit],
      dir,
      {
        NABATABLE_CI_CONTROL_FILE: path.join(dir, 'ignored.json'),
        NABATABLE_CI_ALLOCATION_FILE: path.join(dir, 'missing.json'),
      },
    );
    expect(args.controlFile).toBe(explicit);
    expect(args.request).toEqual(mainRequest());

    const broken = path.join(dir, 'broken.json');
    writeFileSync(broken, 'not json');
    expect(() =>
      parseArgs(['--request', JSON.stringify(mainRequest())], dir, {
        NABATABLE_CI_ALLOCATION_FILE: broken,
      }),
    ).toThrow(CiRequestError);

    // An envelope on the command line is never re-wrapped.
    writeFileSync(
      broken,
      JSON.stringify({ mode: 'normal', allocation: { cpus: 1, memoryGiB: 1 } }),
    );
    const envelope = { request: mainRequest(), mode: 'normal', allocation: null };
    expect(
      parseArgs(['--request', JSON.stringify(envelope)], dir, {
        NABATABLE_CI_ALLOCATION_FILE: broken,
      }).request,
    ).toEqual(envelope);
  });

  it('rejects unknown arguments, missing values, missing requests and invalid JSON', () => {
    expect(() => parseArgs(['--privileged'], '/cwd')).toThrow(CiRequestError);
    expect(() => parseArgs(['--request'], '/cwd')).toThrow(/requires a value/u);
    expect(() => parseArgs([], '/cwd')).toThrow(/--request or --request-file is required/u);
    expect(() => parseArgs(['--request', '{nope'], '/cwd')).toThrow(/valid JSON/u);
    expect(() => parseArgs(['--request', '{}', '--request-file', 'x'], '/cwd')).toThrow(
      /mutually exclusive/u,
    );
  });

  it('returns help without needing a request', () => {
    expect(parseArgs(['--help'], '/cwd').help).toBe(true);
  });
});

describe('readStopSignal', () => {
  it('reads preempt/cancel and treats anything else as continue', () => {
    const dir = makeTempDir();
    const file = path.join(dir, 'control.json');
    expect(readStopSignal(null)).toBe('continue');
    expect(readStopSignal(path.join(dir, 'missing.json'))).toBe('continue');
    writeFileSync(file, JSON.stringify({ stop: 'preempt' }));
    expect(readStopSignal(file)).toBe('preempt');
    writeFileSync(file, JSON.stringify({ stop: 'cancel' }));
    expect(readStopSignal(file)).toBe('cancel');
    writeFileSync(file, JSON.stringify({ stop: 'explode' }));
    expect(readStopSignal(file)).toBe('continue');
    writeFileSync(file, 'garbage');
    expect(readStopSignal(file)).toBe('continue');
  });
});
