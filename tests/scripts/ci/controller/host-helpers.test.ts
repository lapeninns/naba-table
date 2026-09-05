import { describe, expect, it } from 'vitest';

import {
  CAFFEINATE_ARGS,
  createCaffeinateAssertion,
  type SpawnLike,
  type SpawnedProcess,
} from '@/scripts/ci/controller/caffeinate';
import {
  KeychainSecretError,
  createKeychainSecretProvider,
  type ExecFileLike,
} from '@/scripts/ci/controller/keychain';
import { createLogger, sanitizeFields } from '@/scripts/ci/controller/log';

describe('Keychain secret provider', () => {
  it('reads the item with security find-generic-password -w and caches it', async () => {
    const calls: string[][] = [];
    const execFile: ExecFileLike = async (command, args) => {
      calls.push([command, ...args]);
      return { stdout: 'test-secret-value\n', exitCode: 0 };
    };
    let nowMs = 0;
    const provider = createKeychainSecretProvider({
      service: 'nabatable-ci/monitoring/heartbeat-token',
      account: 'nabatable-ci',
      execFile,
      cacheTtlMs: 1000,
      now: () => nowMs,
    });
    expect(await provider()).toBe('test-secret-value');
    expect(await provider()).toBe('test-secret-value');
    expect(calls).toEqual([
      [
        'security',
        'find-generic-password',
        '-s',
        'nabatable-ci/monitoring/heartbeat-token',
        '-a',
        'nabatable-ci',
        '-w',
      ],
    ]);
    nowMs = 2000;
    await provider();
    expect(calls).toHaveLength(2);
  });

  it('fails with an actionable error when the item is missing or empty', async () => {
    const missing = createKeychainSecretProvider({
      service: 'svc',
      account: 'acct',
      execFile: async () => ({ stdout: '', exitCode: 44 }),
    });
    await expect(missing()).rejects.toThrow(KeychainSecretError);
    await expect(missing()).rejects.toThrow(/security add-generic-password -s svc -a acct -w/u);
    const empty = createKeychainSecretProvider({
      service: 'svc',
      account: 'acct',
      execFile: async () => ({ stdout: '\n', exitCode: 0 }),
    });
    await expect(empty()).rejects.toThrow(/empty secret/u);
  });
});

describe('caffeinate sleep assertion', () => {
  function fakeSpawn(): {
    spawn: SpawnLike;
    spawned: { command: string; args: readonly string[]; killed: NodeJS.Signals[] }[];
    exit(code: number | null): void;
  } {
    const spawned: { command: string; args: readonly string[]; killed: NodeJS.Signals[] }[] = [];
    let exitListener: ((code: number | null) => void) | null = null;
    return {
      spawned,
      exit: (code) => exitListener?.(code),
      spawn: (command, args) => {
        const killed: NodeJS.Signals[] = [];
        spawned.push({ command, args, killed });
        const child: SpawnedProcess = {
          pid: 999,
          kill: (signal) => {
            killed.push(signal ?? 'SIGTERM');
          },
          onExit: (listener) => {
            exitListener = listener;
          },
        };
        return child;
      },
    };
  }

  it('owns one caffeinate -i -s -w <pid> child and stops it on request', () => {
    const fake = fakeSpawn();
    const assertion = createCaffeinateAssertion({ spawn: fake.spawn, pid: 1234 });
    expect(assertion.isActive()).toBe(false);
    assertion.start();
    assertion.start();
    expect(fake.spawned).toHaveLength(1);
    expect(fake.spawned[0]?.command).toBe('caffeinate');
    expect(fake.spawned[0]?.args).toEqual([...CAFFEINATE_ARGS, '1234']);
    expect(fake.spawned[0]?.args).toContain('-i');
    expect(assertion.isActive()).toBe(true);
    assertion.stop();
    expect(fake.spawned[0]?.killed).toEqual(['SIGTERM']);
    expect(assertion.isActive()).toBe(false);
  });

  it('clears the active flag when caffeinate exits on its own', () => {
    const fake = fakeSpawn();
    const exits: (number | null)[] = [];
    const assertion = createCaffeinateAssertion({
      spawn: fake.spawn,
      pid: 1,
      onExit: (code) => exits.push(code),
    });
    assertion.start();
    fake.exit(0);
    expect(assertion.isActive()).toBe(false);
    expect(exits).toEqual([0]);
    assertion.stop();
    expect(fake.spawned[0]?.killed).toEqual([]);
  });
});

describe('controller logger', () => {
  it('redacts credential-like keys and scrubs PEM, GitHub token and JWT material', () => {
    // Fragments keep the fake PEM out of the repo secret scanner's header rule.
    const pem = [
      '-----BEGIN RSA ',
      'PRIVATE KEY-----',
      '\nMIIE\n',
      '-----END RSA PRIVATE KEY-----',
    ].join('');
    const fields = sanitizeFields({
      authorization: 'Bearer abc',
      token: 'ghs_abcdefghijklmnopqrstuvwxyz',
      note: `key ${pem} and ghs_abcdefghijklmnopqrstuv and eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiIxIn0.c2lnbmF0dXJlLXNpZ25hdHVyZQ`,
      nested: { privateKeyPem: pem, ok: 'fine' },
    });
    expect(fields.authorization).toBe('[REDACTED]');
    expect(fields.token).toBe('[REDACTED]');
    expect(String(fields.note)).not.toContain('BEGIN RSA');
    expect(String(fields.note)).not.toContain('ghs_');
    expect(String(fields.note)).not.toContain('eyJ');
    expect(JSON.stringify(fields)).not.toContain('MIIE');
    expect((fields.nested as Record<string, unknown>).ok).toBe('fine');
  });

  it('emits structured records with merged child context and level filtering', () => {
    const records: unknown[] = [];
    const logger = createLogger(
      { level: 'info', sink: (record) => records.push(record), now: () => new Date(0) },
      { component: 'controller' },
    );
    const child = logger.child({ attemptId: 'a1' });
    child.debug('hidden');
    child.info('attempt.dispatched', { profile: 'pr' });
    expect(records).toEqual([
      {
        level: 'info',
        message: 'attempt.dispatched',
        at: '1970-01-01T00:00:00.000Z',
        fields: { component: 'controller', attemptId: 'a1', profile: 'pr' },
      },
    ]);
  });
});
