import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  ASSERTION_SQLSTATE,
  FIXTURE_IDS,
  REQUIRES_FIXTURES_MARKER,
  SQL_REGRESSION_FILES,
  SYNTHETIC_FIXTURES_RELATIVE_PATH,
  TRACKED_TABLES,
} from './fixtures';
import { databaseUrlFromEnv, readLinkedProjectRef, validateRemoteTarget } from './targets';

/**
 * Staging-only SQL regression runner.
 *
 * Each regression file is executed as: BEGIN -> synthetic fixtures -> file body -> ROLLBACK.
 * The runner records tracked-table row counts before and after every file and treats any
 * difference as a failed rollback. Any SQL error (including the file's own RAISE) fails the
 * run; a file that completes without error passes. Production is refused at every layer.
 */

export type RegressionQueryRow = Readonly<Record<string, unknown>>;
export type RegressionQuery = (sql: string) => Promise<readonly RegressionQueryRow[]>;

export type RegressionDatabase = {
  readonly query: RegressionQuery;
};

export type RegressionScript = {
  readonly name: string;
  readonly body: string;
};

export type RegressionOutcome = {
  readonly name: string;
  readonly passed: boolean;
  readonly rollbackVerified: boolean;
  readonly error: string | null;
  readonly sqlState: string | null;
};

export type RegressionSuiteResult = {
  readonly ok: boolean;
  readonly outcomes: readonly RegressionOutcome[];
};

/** Leading `--` comment lines (the fixture marker and rationale) may precede the BEGIN. */
const BEGIN_PATTERN = /^((?:\s*--[^\n]*\n)*\s*)BEGIN\s*;/i;
const ROLLBACK_PATTERN = /ROLLBACK\s*;\s*$/i;

function redactContactDetails(message: string): string {
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\+?\d[\d\s-]{6,}\d/g, '[phone]');
}

/**
 * Validate a regression file's structure and strip its own BEGIN/ROLLBACK wrapper so the
 * runner can own the transaction and observe the rollback itself.
 */
export function prepareRegressionScript(name: string, source: string): RegressionScript {
  if (!source.includes(REQUIRES_FIXTURES_MARKER)) {
    throw new Error(`${name} is missing the marker "${REQUIRES_FIXTURES_MARKER}".`);
  }
  if (!BEGIN_PATTERN.test(source)) {
    throw new Error(`${name} must start with BEGIN; so its rollback can be verified.`);
  }
  if (!ROLLBACK_PATTERN.test(source)) {
    throw new Error(`${name} must end with ROLLBACK; so it can never commit.`);
  }
  if (/\bCOMMIT\s*;/i.test(source)) {
    throw new Error(`${name} contains COMMIT; regression files must never commit.`);
  }
  if (!source.includes(`ERRCODE = '${ASSERTION_SQLSTATE}'`)) {
    throw new Error(
      `${name} must raise assertion failures with ERRCODE = '${ASSERTION_SQLSTATE}'.`,
    );
  }
  const referencesFixture = Object.values(FIXTURE_IDS).some((id) => source.includes(id));
  if (!referencesFixture) {
    throw new Error(`${name} does not reference any synthetic fixture identifier.`);
  }
  const body = source.replace(BEGIN_PATTERN, '$1').replace(ROLLBACK_PATTERN, '').trim();
  return { name, body };
}

function countSql(table: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) {
    throw new Error(`Refusing to count untrusted table name "${table}".`);
  }
  return `SELECT count(*)::text AS n FROM public.${table}`;
}

async function readCounts(query: RegressionQuery): Promise<Readonly<Record<string, string>>> {
  const counts: Record<string, string> = {};
  for (const table of TRACKED_TABLES) {
    const rows = await query(countSql(table));
    const value = rows[0]?.n;
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error(`Row count for ${table} was not returned.`);
    }
    counts[table] = String(value);
  }
  return counts;
}

async function fixtureRestaurantCount(query: RegressionQuery): Promise<number> {
  const rows = await query(
    `SELECT count(*)::text AS n FROM public.restaurants WHERE id IN ('${FIXTURE_IDS.restaurantA}', '${FIXTURE_IDS.restaurantB}')`,
  );
  const value = rows[0]?.n;
  return Number(value ?? 'NaN');
}

function countsDiffer(
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>,
): string[] {
  return TRACKED_TABLES.filter((table) => before[table] !== after[table]).map(
    (table) => `${table}: ${before[table]} -> ${after[table]}`,
  );
}

function errorDetails(error: unknown): { message: string; sqlState: string | null } {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code;
    return {
      message: redactContactDetails(error.message),
      sqlState: typeof code === 'string' ? code : null,
    };
  }
  return { message: redactContactDetails(String(error)), sqlState: null };
}

export async function runRegressionFile(
  database: RegressionDatabase,
  script: RegressionScript,
  fixturesSql: string,
): Promise<RegressionOutcome> {
  const preexisting = await fixtureRestaurantCount(database.query);
  if (preexisting !== 0) {
    return {
      name: script.name,
      passed: false,
      rollbackVerified: false,
      error: 'Synthetic fixture restaurants already exist on the target; refusing to run.',
      sqlState: null,
    };
  }

  const before = await readCounts(database.query);
  let failure: { message: string; sqlState: string | null } | null = null;
  let transactionOpen = false;
  try {
    await database.query('BEGIN');
    transactionOpen = true;
    await database.query(fixturesSql);
    await database.query(script.body);
  } catch (error) {
    failure = errorDetails(error);
  } finally {
    if (transactionOpen) {
      try {
        await database.query('ROLLBACK');
      } catch (error) {
        failure ??= errorDetails(error);
      }
    }
  }

  const after = await readCounts(database.query);
  const drift = countsDiffer(before, after);
  const leaked = await fixtureRestaurantCount(database.query);
  const rollbackVerified = drift.length === 0 && leaked === 0;
  const rollbackError = rollbackVerified
    ? null
    : `Rollback verification failed: ${[...drift, ...(leaked === 0 ? [] : ['fixture restaurants remain'])].join('; ')}`;

  return {
    name: script.name,
    passed: failure === null && rollbackVerified,
    rollbackVerified,
    error: failure?.message ?? rollbackError,
    sqlState: failure?.sqlState ?? null,
  };
}

export async function runRegressionSuite(
  database: RegressionDatabase,
  scripts: readonly RegressionScript[],
  fixturesSql: string,
): Promise<RegressionSuiteResult> {
  const outcomes: RegressionOutcome[] = [];
  for (const script of scripts) {
    const outcome = await runRegressionFile(database, script, fixturesSql);
    outcomes.push(outcome);
    if (!outcome.rollbackVerified) {
      break;
    }
  }
  return { ok: outcomes.length === scripts.length && outcomes.every((o) => o.passed), outcomes };
}

export function renderOutcome(outcome: RegressionOutcome): string {
  const status = outcome.passed ? 'PASS' : 'FAIL';
  const rollback = outcome.rollbackVerified ? 'rollback=verified' : 'rollback=UNVERIFIED';
  const detail = outcome.error
    ? ` ${outcome.sqlState ? `[${outcome.sqlState}] ` : ''}${outcome.error}`
    : '';
  return `sql-regression: ${status} ${outcome.name} ${rollback}${detail}\n`;
}

type CliArguments = {
  readonly fixturesPath: string;
  readonly files: readonly string[];
};

export function parseCliArguments(args: readonly string[]): CliArguments {
  const fixturesIndex = args.indexOf('--fixtures');
  const fixturesPath = fixturesIndex === -1 ? null : args[fixturesIndex + 1];
  if (!fixturesPath || fixturesPath.startsWith('--')) {
    throw new Error('--fixtures <path> is required.');
  }
  if (path.normalize(fixturesPath) !== SYNTHETIC_FIXTURES_RELATIVE_PATH) {
    throw new Error(`--fixtures must be ${SYNTHETIC_FIXTURES_RELATIVE_PATH}.`);
  }
  const files = args.filter((arg, index) => index !== fixturesIndex && index !== fixturesIndex + 1);
  if (files.length === 0) {
    throw new Error('At least one regression file is required.');
  }
  for (const file of files) {
    if (!SQL_REGRESSION_FILES.includes(file)) {
      throw new Error(`${file} is not a registered SQL regression file.`);
    }
  }
  return { fixturesPath, files };
}

async function main(): Promise<number> {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const target = process.env.DB_TARGET_ENV;
  if (target !== 'staging') {
    process.stderr.write('sql-regression is staging-only (DB_TARGET_ENV=staging).\n');
    return 2;
  }
  const databaseUrl = databaseUrlFromEnv(process.env);
  const validation = validateRemoteTarget({
    target,
    linkedProjectRef: readLinkedProjectRef(process.env.SUPABASE_WORKDIR?.trim() || repoRoot),
    databaseUrl,
    requireDatabaseUrl: true,
  });
  if (!validation.ok) {
    process.stderr.write(`${validation.message}\n`);
    return 2;
  }

  let cli: CliArguments;
  try {
    cli = parseCliArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }

  const fixturesSql = readFileSync(path.join(repoRoot, cli.fixturesPath), 'utf8');
  let scripts: RegressionScript[];
  try {
    scripts = cli.files.map((file) =>
      prepareRegressionScript(file, readFileSync(path.join(repoRoot, file), 'utf8')),
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }

  const { Client } = await import('pg');
  const { getPgSslConfig } = await import('../pg-ssl');
  const client = new Client({ connectionString: databaseUrl, ssl: getPgSslConfig() });
  await client.connect();
  try {
    const database: RegressionDatabase = {
      query: async (sql) => {
        const result = await client.query(sql);
        return (result.rows ?? []) as readonly RegressionQueryRow[];
      },
    };
    const result = await runRegressionSuite(database, scripts, fixturesSql);
    for (const outcome of result.outcomes) {
      process.stdout.write(renderOutcome(outcome));
    }
    if (result.outcomes.length < scripts.length) {
      process.stderr.write('sql-regression: stopped after unverified rollback.\n');
    }
    return result.ok ? 0 : 1;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(
        `sql-regression: ${redactContactDetails(error instanceof Error ? error.message : String(error))}\n`,
      );
      process.exitCode = 1;
    },
  );
}
