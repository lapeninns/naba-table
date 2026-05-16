import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { getPgSslConfig } from '../db/pg-ssl';
import { assertExactSupabaseProjectRef, DEFAULT_STAGING_PROJECT_REF } from '../db/safety';

type TimingRow = {
  label: string;
  runs: number;
  totalMs: number;
  meanMs: number;
  p95Ms: number;
  maxMs: number;
};

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '../..');
const envLocalPath = path.join(projectRoot, '.env.local');

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

function requireFile(p: string): string {
  if (!fs.existsSync(p)) {
    throw new Error(`Missing required file: ${p}`);
  }
  return fs.readFileSync(p, 'utf8').trim();
}

function buildPgConnectionString(): string {
  const poolerPath = path.join(projectRoot, 'supabase/.temp/pooler-url');
  const pooler = fs.existsSync(poolerPath) ? requireFile(poolerPath) : null;

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      'SUPABASE_DB_PASSWORD is required in .env.local for direct Postgres workload replay.',
    );
  }

  const base = pooler || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      'Missing supabase/.temp/pooler-url and SUPABASE_DB_URL/DATABASE_URL. Link the project or set SUPABASE_DB_URL.',
    );
  }

  const u = new URL(base);
  u.password = password;
  return u.toString();
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function writeCsv(filePath: string, rows: Record<string, unknown>[]): void {
  const headers = Array.from(
    rows.reduce((set, r) => {
      for (const k of Object.keys(r)) set.add(k);
      return set;
    }, new Set<string>()),
  ).sort();

  const escape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };

  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h])).join(','));
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

async function timeQuery(
  client: Client,
  label: string,
  sql: string,
  valuesList: unknown[][],
): Promise<TimingRow> {
  const times: number[] = [];
  for (const values of valuesList) {
    const start = Date.now();
    await client.query(sql, values);
    times.push(Date.now() - start);
  }
  times.sort((a, b) => a - b);
  const total = times.reduce((s, n) => s + n, 0);
  return {
    label,
    runs: times.length,
    totalMs: total,
    meanMs: times.length > 0 ? total / times.length : 0,
    p95Ms: percentile(times, 0.95),
    maxMs: times.length > 0 ? times[times.length - 1] : 0,
  };
}

async function main(): Promise<void> {
  const expectedProjectRef =
    process.env.EXPECTED_PROJECT_REF?.trim() || DEFAULT_STAGING_PROJECT_REF;
  const projectRefPath = path.join(projectRoot, 'supabase/.temp/project-ref');
  if (!fs.existsSync(projectRefPath)) {
    throw new Error(
      'Missing supabase/.temp/project-ref. Run `supabase link --project-ref <ref>` first.',
    );
  }
  const actualProjectRef = requireFile(projectRefPath);
  if (actualProjectRef !== expectedProjectRef) {
    throw new Error(
      `Refusing workload replay: linked project ref (${actualProjectRef}) != expected (${expectedProjectRef}).`,
    );
  }

  const connectionString = buildPgConnectionString();
  assertExactSupabaseProjectRef(connectionString, expectedProjectRef);

  const taskDir = path.join(projectRoot, 'tasks/staging-perf-dataset-20260207-1647');
  const artifactsDir = path.join(taskDir, 'artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });

  const timingsPath = path.join(artifactsDir, 'workload-timings.json');
  const pssTotalPath = path.join(artifactsDir, 'pg_stat_statements_top_total.csv');
  const pssMeanPath = path.join(artifactsDir, 'pg_stat_statements_top_mean.csv');
  const pssCallsPath = path.join(artifactsDir, 'pg_stat_statements_top_calls.csv');
  const pssOltpTotalPath = path.join(artifactsDir, 'pg_stat_statements_oltp_top_total.csv');
  const pssOltpMeanPath = path.join(artifactsDir, 'pg_stat_statements_oltp_top_mean.csv');
  const pssOltpCallsPath = path.join(artifactsDir, 'pg_stat_statements_oltp_top_calls.csv');
  const pssOltpSelectTotalPath = path.join(
    artifactsDir,
    'pg_stat_statements_oltp_select_top_total.csv',
  );
  const pssOltpSelectMeanPath = path.join(
    artifactsDir,
    'pg_stat_statements_oltp_select_top_mean.csv',
  );
  const pssOltpSelectCallsPath = path.join(
    artifactsDir,
    'pg_stat_statements_oltp_select_top_calls.csv',
  );
  const tableSizesPath = path.join(artifactsDir, 'table_sizes_public.csv');
  const seqScanPath = path.join(artifactsDir, 'table_scan_stats_public.csv');
  const indexUsagePath = path.join(artifactsDir, 'index_usage_public.csv');

  const client = new Client({
    connectionString,
    ssl: getPgSslConfig(),
  });

  await client.connect();
  try {
    // Keep replay within a bounded window. We want signal, not 30 minutes of noise.
    await client.query(`set statement_timeout = '60s'`);

    const restaurantsRes = await client.query<{ id: string; slug: string }>(
      `
        select id, slug
        from public.restaurants
        where slug like 'seed-perf-%'
        order by slug asc
        limit 50
      `,
    );
    const restaurants = restaurantsRes.rows;
    if (restaurants.length === 0) {
      throw new Error('No seed-perf restaurants found. Run seed-perf-dataset first.');
    }

    const dateWindowRes = await client.query<{ min: string; max: string }>(
      `
        select
          min(booking_date)::text as min,
          max(booking_date)::text as max
        from public.bookings
        where reference like 'SEEDPERF-%'
      `,
    );
    const dateMin = dateWindowRes.rows[0]?.min;
    const dateMax = dateWindowRes.rows[0]?.max;
    if (!dateMin || !dateMax) {
      throw new Error('No seed bookings found. Run seed-perf-dataset first.');
    }

    // Representative queries based on ops endpoints (simplified SQL equivalent).
    const qBookingsRange = `
      select id, start_at, end_at, booking_date, start_time, end_time, party_size, status, customer_name, customer_email, created_at
      from public.bookings
      where restaurant_id = $1
        and start_at >= $2
        and start_at < $3
      order by start_at desc
      limit $4 offset $5
    `;

    const qBookingsRangeSearch = `
      select id, start_at, end_at, booking_date, start_time, end_time, party_size, status, customer_name, customer_email, created_at
      from public.bookings
      where restaurant_id = $1
        and start_at >= $2
        and start_at < $3
        and (customer_name ilike $6 or customer_email ilike $6)
      order by start_at desc
      limit $4 offset $5
    `;

    const qTodaySummary = `
      select b.id, b.status, b.start_time, b.end_time, b.party_size, b.customer_name, b.reference,
             a.table_id, t.table_number, t.capacity, t.section
      from public.bookings b
      left join public.booking_table_assignments a on a.booking_id = b.id
      left join public.table_inventory t on t.id = a.table_id
      where b.restaurant_id = $1
        and b.booking_date = $2
      order by b.start_time asc
    `;

    // We want a mix across restaurants and time windows but keep bounded runtime.
    const limit = 50;
    const offsets = [0, 50, 100];
    const startAt = `${dateMin}T00:00:00.000Z`;
    const endAt = `${dateMax}T23:59:59.999Z`;

    const valuesRange: unknown[][] = [];
    const valuesSearch: unknown[][] = [];
    const valuesToday: unknown[][] = [];

    for (const r of restaurants) {
      for (const off of offsets) {
        valuesRange.push([r.id, startAt, endAt, limit, off]);
        valuesSearch.push([r.id, startAt, endAt, limit, off, '%SEED%']);
      }
      // Use the max date as “today” within seed window to keep joins non-empty.
      valuesToday.push([r.id, dateMax]);
    }

    const timingRows: TimingRow[] = [];
    // chunk the replay so a single lock spike does not explode runtime
    for (const part of chunk(valuesRange, 50)) {
      timingRows.push(await timeQuery(client, 'ops_bookings_list_range', qBookingsRange, part));
    }
    for (const part of chunk(valuesSearch, 50)) {
      timingRows.push(
        await timeQuery(client, 'ops_bookings_list_search', qBookingsRangeSearch, part),
      );
    }
    for (const part of chunk(valuesToday, 25)) {
      timingRows.push(await timeQuery(client, 'ops_today_summary', qTodaySummary, part));
    }

    fs.writeFileSync(
      timingsPath,
      JSON.stringify(
        {
          ranAtUtc: new Date().toISOString(),
          restaurants: restaurants.length,
          seedBookingDateWindow: { min: dateMin, max: dateMax },
          timings: timingRows,
        },
        null,
        2,
      ),
    );

    // Post-run snapshots for analysis.
    const pssTotal = await client.query(
      `
        select
          queryid,
          calls,
          round(total_exec_time::numeric, 2) as total_ms,
          round(mean_exec_time::numeric, 2) as mean_ms,
          round(max_exec_time::numeric, 2) as max_ms,
          rows,
          shared_blks_hit,
          shared_blks_read,
          temp_blks_read,
          temp_blks_written,
          wal_bytes,
          left(query, 500) as query_sample
        from extensions.pg_stat_statements
        where query not like 'COMMIT%'
          and query not like 'BEGIN%'
          and query not like 'SET %'
          and query not like '--%'
        order by total_exec_time desc
        limit 50
      `,
    );
    writeCsv(pssTotalPath, pssTotal.rows);

    const pssMean = await client.query(
      `
        select
          queryid,
          calls,
          round(total_exec_time::numeric, 2) as total_ms,
          round(mean_exec_time::numeric, 2) as mean_ms,
          round(max_exec_time::numeric, 2) as max_ms,
          rows,
          shared_blks_hit,
          shared_blks_read,
          temp_blks_read,
          temp_blks_written,
          wal_bytes,
          left(query, 500) as query_sample
        from extensions.pg_stat_statements
        where calls >= 10
          and query not like 'COMMIT%'
          and query not like 'BEGIN%'
          and query not like 'SET %'
          and query not like '--%'
        order by mean_exec_time desc
        limit 50
      `,
    );
    writeCsv(pssMeanPath, pssMean.rows);

    const pssCalls = await client.query(
      `
        select
          queryid,
          calls,
          round(total_exec_time::numeric, 2) as total_ms,
          round(mean_exec_time::numeric, 2) as mean_ms,
          round(max_exec_time::numeric, 2) as max_ms,
          rows,
          left(query, 500) as query_sample
        from extensions.pg_stat_statements
        where query not like 'COMMIT%'
          and query not like 'BEGIN%'
          and query not like 'SET %'
          and query not like '--%'
        order by calls desc
        limit 50
      `,
    );
    writeCsv(pssCallsPath, pssCalls.rows);

    // OLTP-focused view: exclude obvious system/realtime noise so the app workload is visible.
    // This intentionally uses a heuristics-based filter instead of relying on role/dbid, since
    // we are running through the pooler.
    const oltpWhere = `
        where calls >= 1
          and query not like 'COMMIT%'
          and query not like 'BEGIN%'
          and query not like 'SET %'
          and query not like '--%'
          and query not like '%pg_catalog.%'
          and query not like '%information_schema.%'
          and query not like '%extensions.pg_stat_statements%'
          and query not like '%realtime.%'
          and query not like '%wal->>%'
          and (query like '%public.bookings%' or query like '%public.customers%' or query like '%public.booking_table_assignments%')
    `;
    // `\\` in JS becomes `\` in SQL. We want Postgres regex `\s` (whitespace).
    const oltpSelectWhere = `${oltpWhere} and query ~* '^\\s*select'`;

    const pssOltpTotal = await client.query(
      `
        select
          queryid,
          calls,
          round(total_exec_time::numeric, 2) as total_ms,
          round(mean_exec_time::numeric, 2) as mean_ms,
          round(max_exec_time::numeric, 2) as max_ms,
          rows,
          shared_blks_hit,
          shared_blks_read,
          temp_blks_read,
          temp_blks_written,
          wal_bytes,
          left(query, 500) as query_sample
        from extensions.pg_stat_statements
        ${oltpWhere}
        order by total_exec_time desc
        limit 50
      `,
    );
    writeCsv(pssOltpTotalPath, pssOltpTotal.rows);

    const pssOltpMean = await client.query(
      `
        select
          queryid,
          calls,
          round(total_exec_time::numeric, 2) as total_ms,
          round(mean_exec_time::numeric, 2) as mean_ms,
          round(max_exec_time::numeric, 2) as max_ms,
          rows,
          shared_blks_hit,
          shared_blks_read,
          temp_blks_read,
          temp_blks_written,
          wal_bytes,
          left(query, 500) as query_sample
        from extensions.pg_stat_statements
        ${oltpWhere}
        order by mean_exec_time desc
        limit 50
      `,
    );
    writeCsv(pssOltpMeanPath, pssOltpMean.rows);

    const pssOltpCalls = await client.query(
      `
        select
          queryid,
          calls,
          round(total_exec_time::numeric, 2) as total_ms,
          round(mean_exec_time::numeric, 2) as mean_ms,
          round(max_exec_time::numeric, 2) as max_ms,
          rows,
          left(query, 500) as query_sample
        from extensions.pg_stat_statements
        ${oltpWhere}
        order by calls desc
        limit 50
      `,
    );
    writeCsv(pssOltpCallsPath, pssOltpCalls.rows);

    const pssOltpSelectTotal = await client.query(
      `
        select
          queryid,
          calls,
          round(total_exec_time::numeric, 2) as total_ms,
          round(mean_exec_time::numeric, 2) as mean_ms,
          round(max_exec_time::numeric, 2) as max_ms,
          rows,
          shared_blks_hit,
          shared_blks_read,
          temp_blks_read,
          temp_blks_written,
          wal_bytes,
          left(query, 500) as query_sample
        from extensions.pg_stat_statements
        ${oltpSelectWhere}
        order by total_exec_time desc
        limit 50
      `,
    );
    writeCsv(pssOltpSelectTotalPath, pssOltpSelectTotal.rows);

    const pssOltpSelectMean = await client.query(
      `
        select
          queryid,
          calls,
          round(total_exec_time::numeric, 2) as total_ms,
          round(mean_exec_time::numeric, 2) as mean_ms,
          round(max_exec_time::numeric, 2) as max_ms,
          rows,
          shared_blks_hit,
          shared_blks_read,
          temp_blks_read,
          temp_blks_written,
          wal_bytes,
          left(query, 500) as query_sample
        from extensions.pg_stat_statements
        ${oltpSelectWhere}
        order by mean_exec_time desc
        limit 50
      `,
    );
    writeCsv(pssOltpSelectMeanPath, pssOltpSelectMean.rows);

    const pssOltpSelectCalls = await client.query(
      `
        select
          queryid,
          calls,
          round(total_exec_time::numeric, 2) as total_ms,
          round(mean_exec_time::numeric, 2) as mean_ms,
          round(max_exec_time::numeric, 2) as max_ms,
          rows,
          left(query, 500) as query_sample
        from extensions.pg_stat_statements
        ${oltpSelectWhere}
        order by calls desc
        limit 50
      `,
    );
    writeCsv(pssOltpSelectCallsPath, pssOltpSelectCalls.rows);

    const tableSizes = await client.query(
      `
        select
          schemaname,
          relname as tablename,
          n_live_tup as est_rows,
          pg_total_relation_size(schemaname || '.' || quote_ident(relname)) as total_bytes,
          pg_size_pretty(pg_total_relation_size(schemaname || '.' || quote_ident(relname))) as total_size,
          pg_size_pretty(pg_relation_size(schemaname || '.' || quote_ident(relname))) as table_size,
          pg_size_pretty(pg_indexes_size(schemaname || '.' || quote_ident(relname))) as indexes_size
        from pg_stat_user_tables
        where schemaname='public'
        order by pg_total_relation_size(schemaname || '.' || quote_ident(relname)) desc
      `,
    );
    writeCsv(tableSizesPath, tableSizes.rows);

    const scans = await client.query(
      `
        select
          schemaname,
          relname as tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch,
          n_live_tup as est_rows
        from pg_stat_user_tables
        where schemaname='public'
        order by seq_scan desc
      `,
    );
    writeCsv(seqScanPath, scans.rows);

    const indexUsage = await client.query(
      `
        select
          sui.schemaname,
          sui.relname as tablename,
          sui.indexrelname as indexname,
          sui.idx_scan as index_scans,
          sui.idx_tup_read as tuples_read,
          sui.idx_tup_fetch as tuples_fetched,
          pg_relation_size(sui.indexrelid) as index_bytes,
          pg_size_pretty(pg_relation_size(sui.indexrelid)) as index_size
        from pg_stat_user_indexes sui
        where sui.schemaname='public'
        order by sui.idx_scan desc
      `,
    );
    writeCsv(indexUsagePath, indexUsage.rows);

    console.log(`[replay-perf] Wrote artifacts under: ${artifactsDir}`);
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error('[replay-perf] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
