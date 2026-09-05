import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import {
  assertPgClientMajor,
  buildPgDumpParts,
  libpqEnvFromUrl,
  parsePgClientMajor,
  PgDumpError,
  type CommandRunner,
} from '../../scripts/db/backup/pg-dump';
import { loadRestoreManifest } from '../../scripts/db/backup/restore-manifest';

function runnerReturning(stdout: string, status = 0): CommandRunner {
  return {
    run: async () => ({ status, stdout, stderr: '' }),
    runWithInput: async () => ({ status, stdout, stderr: '' }),
    stream: () => ({ stdout: Readable.from([]), exit: Promise.resolve({ status, stderr: '' }) }),
  };
}

describe('pg client version gate', () => {
  it('parses major versions', () => {
    expect(parsePgClientMajor('pg_dump (PostgreSQL) 17.4')).toBe(17);
    expect(parsePgClientMajor('pg_dump (PostgreSQL) 16.9 (Homebrew)')).toBe(16);
    expect(parsePgClientMajor('garbage')).toBeNull();
  });

  it('accepts exactly major 17 and refuses everything else', async () => {
    await expect(
      assertPgClientMajor(runnerReturning('pg_dump (PostgreSQL) 17.4'), 'pg_dump'),
    ).resolves.toBe('pg_dump (PostgreSQL) 17.4');
    await expect(
      assertPgClientMajor(runnerReturning('pg_dump (PostgreSQL) 16.9'), 'pg_dump'),
    ).rejects.toThrow(/exactly 17 is required/);
    await expect(
      assertPgClientMajor(runnerReturning('pg_dump (PostgreSQL) 18.0'), 'pg_dump'),
    ).rejects.toThrow(PgDumpError);
    await expect(assertPgClientMajor(runnerReturning('', 127), 'psql')).rejects.toThrow(
      /failed with status 127/,
    );
    const missing: CommandRunner = {
      ...runnerReturning(''),
      run: async () => {
        throw new Error('ENOENT');
      },
    };
    await expect(assertPgClientMajor(missing, 'pg_restore')).rejects.toThrow(/not installed/);
  });
});

describe('pg_dump planning', () => {
  it('derives custom-format parts from the restore manifest without any connection args', () => {
    const parts = buildPgDumpParts(loadRestoreManifest());
    expect(parts.map((part) => part.id)).toEqual(['core', 'auth_data']);
    const core = parts[0];
    expect(core?.args).toEqual(
      expect.arrayContaining([
        '--format=custom',
        '--no-password',
        '--schema=public',
        '--schema=supabase_migrations',
      ]),
    );
    expect(core?.args.some((arg) => arg.includes('cron'))).toBe(false);
    expect(parts[1]?.args).toEqual(
      expect.arrayContaining(['--data-only', '--table=auth.users', '--table=auth.identities']),
    );
    for (const part of parts) {
      expect(
        part.args.some((arg) => /postgres(ql)?:\/\//.test(arg) || arg.startsWith('--dbname')),
      ).toBe(false);
    }
  });

  it('builds a libpq env from the URL and keeps the URL out of argv', () => {
    const env = libpqEnvFromUrl(
      'postgresql://nabatable_backup:p%40ss@db.vrdiqfudmwydclqpydee.supabase.co:6543/postgres',
      {
        PATH: '/usr/bin',
        PGSSLROOTCERT: '/certs/root.crt',
        SUPABASE_SERVICE_ROLE_KEY: 'must-not-leak',
      },
    );
    expect(env).toEqual({
      PATH: '/usr/bin',
      HOME: undefined,
      PGHOST: 'db.vrdiqfudmwydclqpydee.supabase.co',
      PGPORT: '6543',
      PGUSER: 'nabatable_backup',
      PGPASSWORD: 'p@ss',
      PGDATABASE: 'postgres',
      PGSSLMODE: 'require',
      PGCONNECT_TIMEOUT: '30',
      PGSSLROOTCERT: '/certs/root.crt',
    });
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });
});
