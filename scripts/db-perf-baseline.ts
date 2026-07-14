/**
 * Database Performance Baseline Discovery Script
 * Connects to Supabase and gathers comprehensive performance metrics
 *
 * Run with: tsx scripts/db-perf-baseline.ts
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { getPgSslConfig } from './db/pg-ssl';

const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL. Set it before running this script.');
  process.exit(1);
}

interface QueryResult {
  name: string;
  data: unknown[];
  error?: string;
}

const queries: { name: string; sql: string }[] = [
  {
    name: 'postgres_version',
    sql: 'SELECT version() AS postgres_version',
  },
  {
    name: 'extensions',
    sql: `
      SELECT 
        extname AS extension_name, 
        extversion AS version,
        n.nspname AS schema
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
      ORDER BY extname
    `,
  },
  {
    name: 'table_sizes',
    sql: `
      SELECT 
        schemaname,
        tablename,
        n_live_tup AS estimated_row_count,
        pg_size_pretty(pg_total_relation_size(schemaname || '.' || quote_ident(tablename))) AS total_size,
        pg_size_pretty(pg_relation_size(schemaname || '.' || quote_ident(tablename))) AS table_size,
        pg_size_pretty(pg_indexes_size(schemaname || '.' || quote_ident(tablename))) AS indexes_size,
        pg_total_relation_size(schemaname || '.' || quote_ident(tablename)) AS total_size_bytes
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname || '.' || quote_ident(tablename)) DESC
    `,
  },
  {
    name: 'table_vacuum_stats',
    sql: `
      SELECT 
        schemaname,
        relname AS tablename,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze,
        n_dead_tup AS dead_tuples,
        n_live_tup AS live_tuples,
        ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_pct,
        autovacuum_count,
        autoanalyze_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_dead_tup DESC
    `,
  },
  {
    name: 'all_indexes',
    sql: `
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef,
        idx_scan AS index_scans,
        idx_tup_read AS tuples_read,
        idx_tup_fetch AS tuples_fetched,
        pg_size_pretty(pg_relation_size(schemaname || '.' || quote_ident(indexname))) AS index_size,
        pg_relation_size(schemaname || '.' || quote_ident(indexname)) AS index_size_bytes
      FROM pg_stat_user_indexes sui
      JOIN pg_indexes pi 
        ON sui.indexrelname = pi.indexname 
        AND sui.schemaname = pi.schemaname
      WHERE sui.schemaname = 'public'
      ORDER BY idx_scan DESC
    `,
  },
  {
    name: 'unused_indexes',
    sql: `
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef,
        pg_size_pretty(pg_relation_size(schemaname || '.' || quote_ident(indexname))) AS index_size,
        pg_relation_size(schemaname || '.' || quote_ident(indexname)) AS index_size_bytes
      FROM pg_stat_user_indexes sui
      JOIN pg_indexes pi 
        ON sui.indexrelname = pi.indexname 
        AND sui.schemaname = pi.schemaname
      WHERE sui.schemaname = 'public'
        AND idx_scan = 0
        AND indexdef NOT LIKE '%UNIQUE%'
        AND indexdef NOT LIKE '%PRIMARY%'
      ORDER BY pg_relation_size(schemaname || '.' || quote_ident(indexname)) DESC
    `,
  },
  {
    name: 'missing_fk_indexes',
    sql: `
      SELECT
        c.conrelid::regclass AS table_name,
        c.conname AS constraint_name,
        a.attname AS column_name,
        c.confrelid::regclass AS referenced_table
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.contype = 'f'
        AND c.conrelid::regclass::text NOT LIKE 'pg_%'
        AND NOT EXISTS (
          SELECT 1
          FROM pg_index i
          WHERE i.indrelid = c.conrelid
            AND a.attnum = ANY(i.indkey)
        )
      ORDER BY c.conrelid::regclass::text
    `,
  },
  {
    name: 'top_queries_by_total_time',
    sql: `
      SELECT 
        left(query, 500) AS query_preview,
        calls,
        round(total_exec_time::numeric, 2) AS total_time_ms,
        round(mean_exec_time::numeric, 2) AS avg_time_ms,
        round(min_exec_time::numeric, 2) AS min_time_ms,
        round(max_exec_time::numeric, 2) AS max_time_ms,
        round(stddev_exec_time::numeric, 2) AS stddev_ms,
        rows,
        round(100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0), 2) AS cache_hit_pct
      FROM extensions.pg_stat_statements
      WHERE query NOT LIKE 'COMMIT%'
        AND query NOT LIKE 'BEGIN%'
        AND query NOT LIKE 'SET %'
        AND query NOT LIKE '--%'
      ORDER BY total_exec_time DESC
      LIMIT 30
    `,
  },
  {
    name: 'top_queries_by_avg_time',
    sql: `
      SELECT 
        left(query, 500) AS query_preview,
        calls,
        round(mean_exec_time::numeric, 2) AS avg_time_ms,
        round(max_exec_time::numeric, 2) AS max_time_ms,
        rows,
        round(100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0), 2) AS cache_hit_pct
      FROM extensions.pg_stat_statements
      WHERE calls >= 10
        AND query NOT LIKE 'COMMIT%'
        AND query NOT LIKE 'BEGIN%'
        AND query NOT LIKE '--%'
      ORDER BY mean_exec_time DESC
      LIMIT 30
    `,
  },
  {
    name: 'top_queries_by_frequency',
    sql: `
      SELECT 
        left(query, 500) AS query_preview,
        calls,
        round(total_exec_time::numeric, 2) AS total_time_ms,
        round(mean_exec_time::numeric, 2) AS avg_time_ms,
        rows
      FROM extensions.pg_stat_statements
      WHERE query NOT LIKE 'COMMIT%'
        AND query NOT LIKE 'BEGIN%'
        AND query NOT LIKE '--%'
      ORDER BY calls DESC
      LIMIT 30
    `,
  },
  {
    name: 'sequential_scans',
    sql: `
      SELECT 
        schemaname,
        relname AS tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch,
        n_live_tup AS estimated_rows,
        CASE 
          WHEN seq_scan + COALESCE(idx_scan, 0) > 0 
          THEN round(100.0 * seq_scan / (seq_scan + COALESCE(idx_scan, 0)), 2)
          ELSE 0 
        END AS seq_scan_pct,
        pg_size_pretty(pg_relation_size(schemaname || '.' || quote_ident(relname))) AS table_size
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
        AND (seq_scan > 0 OR idx_scan > 0)
      ORDER BY seq_scan DESC
    `,
  },
  {
    name: 'connection_stats',
    sql: `
      SELECT 
        count(*) AS total_connections,
        count(*) FILTER (WHERE state = 'active') AS active,
        count(*) FILTER (WHERE state = 'idle') AS idle,
        count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction,
        count(*) FILTER (WHERE state = 'idle in transaction (aborted)') AS aborted,
        max(EXTRACT(EPOCH FROM (now() - backend_start))) AS oldest_connection_seconds
      FROM pg_stat_activity
      WHERE backend_type = 'client backend'
    `,
  },
  {
    name: 'cache_hit_ratio',
    sql: `
      SELECT 
        sum(heap_blks_read) AS heap_read,
        sum(heap_blks_hit) AS heap_hit,
        round(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS cache_hit_ratio
      FROM pg_statio_user_tables
    `,
  },
  {
    name: 'per_table_cache_hit',
    sql: `
      SELECT 
        schemaname,
        relname AS tablename,
        heap_blks_read,
        heap_blks_hit,
        round(100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0), 2) AS hit_ratio
      FROM pg_statio_user_tables
      WHERE schemaname = 'public'
        AND (heap_blks_read + heap_blks_hit) > 100
      ORDER BY heap_blks_read DESC
      LIMIT 20
    `,
  },
  {
    name: 'rls_policies',
    sql: `
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles::text,
        cmd,
        left(qual::text, 500) AS using_expression,
        left(with_check::text, 500) AS with_check_expression
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `,
  },
  {
    name: 'rls_enabled_tables',
    sql: `
      SELECT 
        n.nspname AS schema,
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND n.nspname = 'public'
        AND c.relrowsecurity = true
      ORDER BY c.relname
    `,
  },
  {
    name: 'autovacuum_settings',
    sql: `
      SELECT name, setting, unit, short_desc
      FROM pg_settings
      WHERE name LIKE '%autovacuum%'
         OR name LIKE '%vacuum%'
      ORDER BY name
    `,
  },
  {
    name: 'database_summary',
    sql: `
      SELECT 
        pg_database.datname AS database,
        pg_size_pretty(pg_database_size(pg_database.datname)) AS size,
        numbackends AS active_connections,
        xact_commit AS commits,
        xact_rollback AS rollbacks,
        blks_read,
        blks_hit,
        round(100.0 * blks_hit / NULLIF(blks_hit + blks_read, 0), 2) AS cache_hit_pct,
        tup_returned,
        tup_fetched,
        tup_inserted,
        tup_updated,
        tup_deleted,
        conflicts,
        deadlocks
      FROM pg_stat_database
      JOIN pg_database ON pg_database.datname = pg_stat_database.datname
      WHERE pg_database.datname = current_database()
    `,
  },
  {
    name: 'hot_tables_by_updates',
    sql: `
      SELECT 
        schemaname,
        relname AS tablename,
        n_tup_ins AS inserts,
        n_tup_upd AS updates,
        n_tup_del AS deletes,
        n_tup_hot_upd AS hot_updates,
        n_live_tup AS live_tuples,
        CASE WHEN n_tup_upd > 0 
          THEN round(100.0 * n_tup_hot_upd / n_tup_upd, 2)
          ELSE 0 
        END AS hot_update_pct
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_tup_upd DESC
      LIMIT 20
    `,
  },
  {
    name: 'function_calls',
    sql: `
      SELECT 
        left(query, 500) AS query_preview,
        calls,
        round(total_exec_time::numeric, 2) AS total_time_ms,
        round(mean_exec_time::numeric, 2) AS avg_time_ms
      FROM extensions.pg_stat_statements
      WHERE query LIKE '%SELECT%public.%(%'
         OR query LIKE 'SELECT public.%'
      ORDER BY total_exec_time DESC
      LIMIT 30
    `,
  },
];

function resolveOutputPath(): string {
  return path.resolve(
    process.env.DB_PERF_BASELINE_OUTPUT_PATH ??
      path.join(
        __dirname,
        '../test-results/performance/db-perf-optimization/baseline-results.json',
      ),
  );
}

async function runBaseline() {
  const client = new Client({
    connectionString,
    ssl: getPgSslConfig(),
  });

  const results: QueryResult[] = [];

  try {
    await client.connect();
    console.log('✅ Connected to database');
    console.log('');

    for (const query of queries) {
      try {
        console.log(`📊 Running: ${query.name}...`);
        const result = await client.query(query.sql);
        results.push({
          name: query.name,
          data: result.rows,
        });
        console.log(`   Found ${result.rows.length} rows`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`   ❌ Error: ${errorMessage}`);
        results.push({
          name: query.name,
          data: [],
          error: errorMessage,
        });
      }
    }

    // Save to JSON file
    const outputPath = resolveOutputPath();
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log('');
    console.log(`✅ Results saved to: ${outputPath}`);

    // Print summary
    console.log('');
    console.log('='.repeat(60));
    console.log('BASELINE SUMMARY');
    console.log('='.repeat(60));

    // Database version
    const versionResult = results.find((r) => r.name === 'postgres_version');
    if (versionResult?.data[0]) {
      console.log(
        `\nPostgreSQL Version: ${(versionResult.data[0] as { postgres_version: string }).postgres_version}`,
      );
    }

    // Database size
    const dbSummary = results.find((r) => r.name === 'database_summary');
    if (dbSummary?.data[0]) {
      const summary = dbSummary.data[0] as {
        size: string;
        cache_hit_pct: number;
        deadlocks: number;
      };
      console.log(`\nDatabase Size: ${summary.size}`);
      console.log(`Cache Hit Ratio: ${summary.cache_hit_pct}%`);
      console.log(`Deadlocks: ${summary.deadlocks}`);
    }

    // Table count
    const tableSizes = results.find((r) => r.name === 'table_sizes');
    if (tableSizes?.data) {
      console.log(`\nTotal Tables: ${tableSizes.data.length}`);

      // Top 5 largest tables
      console.log('\nTop 5 Largest Tables:');
      tableSizes.data.slice(0, 5).forEach((table: unknown, i: number) => {
        const t = table as { tablename: string; total_size: string; estimated_row_count: number };
        console.log(`  ${i + 1}. ${t.tablename}: ${t.total_size} (~${t.estimated_row_count} rows)`);
      });
    }

    // Unused indexes
    const unusedIndexes = results.find((r) => r.name === 'unused_indexes');
    if (unusedIndexes?.data) {
      console.log(`\nUnused Indexes: ${unusedIndexes.data.length}`);
      if (unusedIndexes.data.length > 0) {
        console.log('  (These may be candidates for removal - verify before dropping)');
      }
    }

    // Missing FK indexes
    const missingFk = results.find((r) => r.name === 'missing_fk_indexes');
    if (missingFk?.data) {
      console.log(`\nMissing FK Indexes: ${missingFk.data.length}`);
    }

    // Sequential scan heavy tables
    const seqScans = results.find((r) => r.name === 'sequential_scans');
    if (seqScans?.data) {
      const highSeqScan = seqScans.data.filter((t: unknown) => {
        const table = t as { seq_scan_pct: number; estimated_rows: number };
        return table.seq_scan_pct > 50 && table.estimated_rows > 1000;
      });
      console.log(`\nTables with >50% Sequential Scans (>1000 rows): ${highSeqScan.length}`);
      highSeqScan.slice(0, 5).forEach((table: unknown) => {
        const t = table as { tablename: string; seq_scan_pct: number; estimated_rows: number };
        console.log(`  - ${t.tablename}: ${t.seq_scan_pct}% seq scans (~${t.estimated_rows} rows)`);
      });
    }

    // RLS policies
    const rlsPolicies = results.find((r) => r.name === 'rls_policies');
    if (rlsPolicies?.data) {
      console.log(`\nRLS Policies: ${rlsPolicies.data.length}`);
    }

    // Top slow queries
    const slowQueries = results.find((r) => r.name === 'top_queries_by_avg_time');
    if (slowQueries?.data && slowQueries.data.length > 0) {
      console.log('\nTop 5 Slowest Queries (by avg time, min 10 calls):');
      slowQueries.data.slice(0, 5).forEach((q: unknown, i: number) => {
        const query = q as { avg_time_ms: number; calls: number; query_preview: string };
        console.log(`  ${i + 1}. ${query.avg_time_ms}ms avg (${query.calls} calls)`);
        console.log(`     ${query.query_preview.substring(0, 80)}...`);
      });
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Full results saved to JSON file for detailed analysis.');
    console.log('='.repeat(60));
  } catch (err) {
    console.error('Fatal error:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

runBaseline();
