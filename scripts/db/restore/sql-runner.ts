import { parseCsv } from '../backup/csv';
import type { CommandEnv, CommandRunner } from '../backup/pg-dump';

/** Injectable SQL access for the restore drill; the default is psql --csv. */

export type SqlRow = Readonly<Record<string, string>>;

export type SqlRunner = {
  query(sql: string): Promise<readonly SqlRow[]>;
  /** Execute a script that may contain multiple statements; throws on error. */
  execute(sql: string): Promise<void>;
};

export class SqlRunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SqlRunnerError';
  }
}

export function createPsqlRunner(runner: CommandRunner, libpqEnv: CommandEnv): SqlRunner {
  const baseArgs = ['--no-psqlrc', '--no-password', '-v', 'ON_ERROR_STOP=1'];
  return {
    async query(sql) {
      const result = await runner.run('psql', [...baseArgs, '--csv', '-c', sql], libpqEnv);
      if (result.status !== 0) {
        throw new SqlRunnerError(`psql query failed with status ${String(result.status)}.`);
      }
      return parseCsv(result.stdout);
    },
    async execute(sql) {
      const result = await runner.runWithInput(
        'psql',
        [...baseArgs, '--quiet', '-f', '-'],
        Buffer.from(sql, 'utf8'),
        libpqEnv,
      );
      if (result.status !== 0) {
        throw new SqlRunnerError(`psql script failed with status ${String(result.status)}.`);
      }
    },
  };
}

export function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
