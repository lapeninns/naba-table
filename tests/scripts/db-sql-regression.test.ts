import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ASSERTION_SQLSTATE,
  FIXTURE_IDS,
  REQUIRES_FIXTURES_MARKER,
  SQL_REGRESSION_FILES,
  SYNTHETIC_FIXTURES_RELATIVE_PATH,
  TRACKED_TABLES,
} from '@/scripts/db/migrations/fixtures';
import {
  parseCliArguments,
  prepareRegressionScript,
  renderOutcome,
  runRegressionFile,
  runRegressionSuite,
  type RegressionDatabase,
  type RegressionQueryRow,
} from '@/scripts/db/migrations/sql-regression';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const fixturesSql = readFileSync(path.join(repoRoot, SYNTHETIC_FIXTURES_RELATIVE_PATH), 'utf8');
const regressionSources = SQL_REGRESSION_FILES.map((file) => ({
  file,
  source: readFileSync(path.join(repoRoot, file), 'utf8'),
}));

/** Handler starts are lines consisting only of EXCEPTION (RAISE EXCEPTION lines never match). */
const HANDLER_START = /^\s*EXCEPTION\s*$/gm;
const ASSERTION_FIRST = new RegExp(
  `^\\s*EXCEPTION\\s*\\n\\s*WHEN SQLSTATE '${ASSERTION_SQLSTATE}' THEN\\s*RAISE;`,
  'gm',
);
const OUTER_RERAISE =
  /EXCEPTION\s*\n\s*WHEN OTHERS THEN\s*\n\s*RAISE NOTICE[^\n]*FAILED[^\n]*\n\s*RAISE;\s*\nEND;\s*\n\$regression\$;\s*\n\s*ROLLBACK;\s*$/;

describe('SQL regression files', () => {
  it('registers exactly the three reviewed regression files', () => {
    expect(SQL_REGRESSION_FILES).toEqual([
      'tests/db/terminal-booking-table-release.sql',
      'supabase/tests/mobile_sms_attempt_finalization.sql',
      'supabase/tests/whatsapp_review_notification_ledger.sql',
    ]);
  });

  it.each(regressionSources)(
    '$file never selects arbitrary existing rows and names synthetic fixtures',
    ({ source }) => {
      expect(source).not.toMatch(/\bLIMIT\s+1\b/i);
      expect(source).not.toMatch(/\bLIMIT\b/i);
      expect(source).not.toMatch(/gen_random_uuid\(\)/);
      expect(source).not.toMatch(/ORDER BY\s+random\(\)/i);
      expect(source).toContain(REQUIRES_FIXTURES_MARKER);
      expect(source).toContain(FIXTURE_IDS.restaurantA);
      const referenced = Object.values(FIXTURE_IDS).filter((id) => source.includes(id));
      expect(referenced.length).toBeGreaterThanOrEqual(2);
    },
  );

  it.each(regressionSources)(
    '$file is wrapped in BEGIN ... ROLLBACK and never commits',
    ({ source }) => {
      expect(source).toMatch(/^(--[^\n]*\n)*BEGIN;/);
      expect(source.trimEnd()).toMatch(/ROLLBACK;$/);
      expect(source).not.toMatch(/\bCOMMIT\b/i);
      expect(source).not.toMatch(/\bSAVEPOINT\b/i);
    },
  );

  it.each(regressionSources)(
    '$file cannot swallow its own assertion failures and ends by re-raising',
    ({ source }) => {
      const handlerStarts = source.match(HANDLER_START)?.length ?? 0;
      const assertionFirst = source.match(ASSERTION_FIRST)?.length ?? 0;

      // Every nested negative-test handler re-raises NB001 before any other clause; the single
      // outer handler logs and re-raises whatever escaped.
      expect(handlerStarts).toBeGreaterThanOrEqual(1);
      expect(assertionFirst).toBe(handlerStarts - 1);
      expect(source).toMatch(OUTER_RERAISE);
      expect(source).toMatch(/RAISE EXCEPTION[\s\S]*?USING ERRCODE = 'NB001'/);
      expect(source).not.toMatch(/WHEN OTHERS THEN\s*\n\s*NULL;\s*\n\s*END;\s*\n\s*\$regression\$/);
    },
  );

  it.each(regressionSources)('$file uses only reserved synthetic contact details', ({ source }) => {
    const phones = source.match(/\+\d{7,15}/g) ?? [];
    for (const phone of phones) {
      expect(phone).toMatch(/^\+4470000000\d{2}$/);
    }
    const emails = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    for (const email of emails) {
      expect(email).toMatch(/\.invalid$/);
    }
  });

  it.each(regressionSources)(
    '$file scopes every fixture write to a synthetic restaurant',
    ({ source }) => {
      const restaurantScoped = source.match(
        /restaurant_id = v_restaurant_id|v_restaurant_id,|v_other_restaurant_id/g,
      );
      expect(restaurantScoped?.length ?? 0).toBeGreaterThan(0);
      expect(source).toMatch(
        /v_restaurant_id constant uuid := '00000000-0000-4000-8000-00000000a001'/,
      );
    },
  );

  it('prepares every registered file for the runner', () => {
    for (const { file, source } of regressionSources) {
      const script = prepareRegressionScript(file, source);
      expect(script.body).not.toMatch(/^\s*BEGIN\s*;/i);
      expect(script.body).not.toMatch(/ROLLBACK\s*;\s*$/i);
      expect(script.body).toContain('$regression$');
    }
  });

  it('refuses files that lack the structural guarantees', () => {
    const { source } = regressionSources[0];
    expect(() =>
      prepareRegressionScript('x.sql', source.replace(REQUIRES_FIXTURES_MARKER, '')),
    ).toThrow(/missing the marker/);
    expect(() => prepareRegressionScript('x.sql', source.replace(/ROLLBACK;\s*$/, ''))).toThrow(
      /must end with ROLLBACK/,
    );
    expect(() => prepareRegressionScript('x.sql', `${source}\nCOMMIT;\nROLLBACK;`)).toThrow(
      /must never commit/,
    );
    expect(() =>
      prepareRegressionScript(
        'x.sql',
        source.replaceAll(`ERRCODE = '${ASSERTION_SQLSTATE}'`, "ERRCODE = 'P0001'"),
      ),
    ).toThrow(/must raise assertion failures/);
  });
});

describe('synthetic fixtures', () => {
  it('documents that rollback does not recall external messages and never enqueues deliveries', () => {
    expect(fixturesSql).toMatch(
      /rollback undoes rows,?\s*\n?--\s*not SMS\/WhatsApp\/email messages/i,
    );
    for (const forbidden of [
      /pg_notify/i,
      /\bnet\.http/i,
      /http_post/i,
      /pgmq/i,
      /\bNOTIFY\b/,
      /\bCOMMIT\b/i,
      /mobile_notification_attempts/i,
      /email_outbox/i,
    ]) {
      expect(fixturesSql).not.toMatch(forbidden);
    }
  });

  it('declares deterministic identifiers that match the shared constants', () => {
    for (const id of Object.values(FIXTURE_IDS)) {
      expect(id).toMatch(/^00000000-0000-4000-8000-00000000[a-f0-9]{4}$/);
      expect(fixturesSql).toContain(id);
    }
    expect(fixturesSql).not.toMatch(/gen_random_uuid\(\)/);
    expect(fixturesSql).not.toMatch(/\bLIMIT\b/i);
  });

  it('keeps every fixture row scoped to one of the two synthetic restaurants', () => {
    const inserts = fixturesSql.split(/INSERT INTO public\./).slice(1);
    expect(inserts.length).toBeGreaterThanOrEqual(6);
    for (const insert of inserts) {
      const table = insert.slice(0, insert.indexOf(' ')).trim();
      if (table === 'restaurants') {
        expect(insert).toContain(FIXTURE_IDS.restaurantA);
        expect(insert).toContain(FIXTURE_IDS.restaurantB);
        continue;
      }
      expect(insert).toMatch(/restaurant_id/);
      expect(insert).toContain(FIXTURE_IDS.restaurantA);
    }
  });
});

type FakeDatabaseOptions = {
  readonly failBodyWith?: Error & { code?: string };
  readonly leakAfterRollback?: boolean;
  readonly preexistingFixtures?: boolean;
  readonly failRollback?: boolean;
};

function createFakeDatabase(options: FakeDatabaseOptions = {}): RegressionDatabase & {
  readonly statements: string[];
} {
  const statements: string[] = [];
  let inTransaction = false;
  let rolledBack = false;
  const query = async (sql: string): Promise<readonly RegressionQueryRow[]> => {
    statements.push(sql);
    if (sql === 'BEGIN') {
      inTransaction = true;
      return [];
    }
    if (sql === 'ROLLBACK') {
      if (options.failRollback) {
        throw Object.assign(new Error('connection lost during rollback'), { code: '08006' });
      }
      inTransaction = false;
      rolledBack = true;
      return [];
    }
    if (sql.startsWith('SELECT count(*)::text AS n FROM public.restaurants WHERE id IN')) {
      const leaked = options.leakAfterRollback && rolledBack ? 1 : 0;
      return [{ n: String(options.preexistingFixtures ? 2 : leaked) }];
    }
    if (sql.startsWith('SELECT count(*)::text AS n FROM public.')) {
      const table = sql.slice('SELECT count(*)::text AS n FROM public.'.length);
      const base = TRACKED_TABLES.indexOf(table) + 10;
      const drift = options.leakAfterRollback && rolledBack && table === 'bookings' ? 2 : 0;
      return [{ n: String(base + drift) }];
    }
    if (!inTransaction) {
      throw new Error(`statement outside transaction: ${sql.slice(0, 40)}`);
    }
    if (sql === fixturesSql) {
      return [];
    }
    if (options.failBodyWith) {
      throw options.failBodyWith;
    }
    return [];
  };
  return {
    query,
    statements,
  };
}

describe('SQL regression runner', () => {
  const script = prepareRegressionScript(regressionSources[0].file, regressionSources[0].source);

  it('runs BEGIN, fixtures, body and ROLLBACK and verifies the rollback by row counts', async () => {
    const database = createFakeDatabase();

    const outcome = await runRegressionFile(database, script, fixturesSql);

    expect(outcome).toEqual({
      name: script.name,
      passed: true,
      rollbackVerified: true,
      error: null,
      sqlState: null,
    });
    const transactional = database.statements.filter((sql) =>
      ['BEGIN', fixturesSql, script.body, 'ROLLBACK'].includes(sql),
    );
    expect(transactional).toEqual(['BEGIN', fixturesSql, script.body, 'ROLLBACK']);
    const countQueries = database.statements.filter((sql) =>
      sql.startsWith('SELECT count(*)::text AS n FROM public.'),
    );
    expect(countQueries.length).toBe(TRACKED_TABLES.length * 2 + 2);
    expect(renderOutcome(outcome)).toBe(`sql-regression: PASS ${script.name} rollback=verified\n`);
  });

  it('treats any SQL error as failure, still rolls back, and reports the assertion SQLSTATE', async () => {
    const failure = Object.assign(new Error('cancelled booking retained active table state'), {
      code: ASSERTION_SQLSTATE,
    });
    const database = createFakeDatabase({ failBodyWith: failure });

    const outcome = await runRegressionFile(database, script, fixturesSql);

    expect(outcome.passed).toBe(false);
    expect(outcome.sqlState).toBe(ASSERTION_SQLSTATE);
    expect(outcome.rollbackVerified).toBe(true);
    expect(outcome.error).toContain('retained active table state');
    expect(database.statements).toContain('ROLLBACK');
    expect(renderOutcome(outcome)).toContain(
      `FAIL ${script.name} rollback=verified [${ASSERTION_SQLSTATE}]`,
    );
  });

  it('redacts contact details from database error messages', async () => {
    const failure = Object.assign(
      new Error('duplicate key for guest@example.com with phone +447700900123'),
      { code: '23505' },
    );
    const database = createFakeDatabase({ failBodyWith: failure });

    const outcome = await runRegressionFile(database, script, fixturesSql);

    expect(outcome.error).not.toContain('guest@example.com');
    expect(outcome.error).not.toContain('447700900123');
    expect(outcome.error).toContain('[email]');
  });

  it('marks the rollback unverified when row counts or fixture rows survive', async () => {
    const database = createFakeDatabase({ leakAfterRollback: true });

    const outcome = await runRegressionFile(database, script, fixturesSql);

    expect(outcome.passed).toBe(false);
    expect(outcome.rollbackVerified).toBe(false);
    expect(outcome.error).toContain('Rollback verification failed');
    expect(outcome.error).toContain('bookings: ');
    expect(outcome.error).toContain('fixture restaurants remain');
    expect(renderOutcome(outcome)).toContain('rollback=UNVERIFIED');
  });

  it('surfaces a rollback failure as the run failure', async () => {
    const database = createFakeDatabase({ failRollback: true });

    const outcome = await runRegressionFile(database, script, fixturesSql);

    expect(outcome.passed).toBe(false);
    expect(outcome.sqlState).toBe('08006');
    expect(outcome.error).toContain('rollback');
  });

  it('refuses to run when synthetic fixture restaurants already exist on the target', async () => {
    const database = createFakeDatabase({ preexistingFixtures: true });

    const outcome = await runRegressionFile(database, script, fixturesSql);

    expect(outcome.passed).toBe(false);
    expect(outcome.error).toContain('already exist on the target');
    expect(database.statements).not.toContain('BEGIN');
  });

  it('runs every file when rollbacks verify and stops after an unverified rollback', async () => {
    const scripts = regressionSources.map(({ file, source }) =>
      prepareRegressionScript(file, source),
    );

    const healthy = await runRegressionSuite(createFakeDatabase(), scripts, fixturesSql);
    expect(healthy.ok).toBe(true);
    expect(healthy.outcomes.map((outcome) => outcome.name)).toEqual(SQL_REGRESSION_FILES);

    const failing = await runRegressionSuite(
      createFakeDatabase({ failBodyWith: Object.assign(new Error('boom'), { code: 'P0001' }) }),
      scripts,
      fixturesSql,
    );
    expect(failing.ok).toBe(false);
    expect(failing.outcomes).toHaveLength(scripts.length);
    expect(failing.outcomes.every((outcome) => !outcome.passed && outcome.rollbackVerified)).toBe(
      true,
    );

    const leaking = await runRegressionSuite(
      createFakeDatabase({ leakAfterRollback: true }),
      scripts,
      fixturesSql,
    );
    expect(leaking.ok).toBe(false);
    expect(leaking.outcomes).toHaveLength(1);
  });

  it('accepts only the registered files and the fixed fixtures path on the command line', () => {
    expect(
      parseCliArguments(['--fixtures', SYNTHETIC_FIXTURES_RELATIVE_PATH, ...SQL_REGRESSION_FILES]),
    ).toEqual({ fixturesPath: SYNTHETIC_FIXTURES_RELATIVE_PATH, files: SQL_REGRESSION_FILES });
    expect(() => parseCliArguments([...SQL_REGRESSION_FILES])).toThrow(
      /--fixtures <path> is required/,
    );
    expect(() =>
      parseCliArguments(['--fixtures', 'tests/db/other.sql', ...SQL_REGRESSION_FILES]),
    ).toThrow(/--fixtures must be/);
    expect(() =>
      parseCliArguments(['--fixtures', SYNTHETIC_FIXTURES_RELATIVE_PATH, 'supabase/seed.sql']),
    ).toThrow(/not a registered SQL regression file/);
    expect(() => parseCliArguments(['--fixtures', SYNTHETIC_FIXTURES_RELATIVE_PATH])).toThrow(
      /At least one regression file/,
    );
  });
});
