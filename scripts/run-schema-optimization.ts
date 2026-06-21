/**
 * Database Schema Optimization Script
 * Executes the schema optimization fixes directly on Supabase
 *
 * Run with:
 *   DB_TARGET_ENV=staging CONFIRM_STAGING_SCHEMA_OPTIMIZATION=true \
 *   SUPABASE_DB_URL="postgresql://postgres.<project_ref>:<password>@aws-1-<region>.pooler.supabase.com:6543/postgres" \
 *   npx tsx scripts/run-schema-optimization.ts
 *
 * NOTE: This script intentionally requires an explicit SUPABASE_DB_URL so it cannot accidentally target an old/stale project.
 */

import { Client } from 'pg';
import { getPgSslConfig } from './db/pg-ssl';
import { assertStagingScriptSafety } from './db/safety';

const connectionString = process.env.SUPABASE_DB_URL?.trim() || '';

if (!connectionString) {
  console.error('❌ Missing SUPABASE_DB_URL.');
  console.error('   Set SUPABASE_DB_URL environment variable.');
  console.error('');
  console.error('   Example:');
  console.error(
    '   DB_TARGET_ENV=staging CONFIRM_STAGING_SCHEMA_OPTIMIZATION=true SUPABASE_DB_URL="postgresql://postgres.<project_ref>:<password>@aws-1-<region>.pooler.supabase.com:6543/postgres" npx tsx scripts/run-schema-optimization.ts',
  );
  process.exit(1);
}

interface PhaseResult {
  phase: string;
  success: boolean;
  commands: number;
  errors: string[];
  duration: number;
}

// ============================================================
// PHASE 1: VACUUM, ANALYZE & CREATE INDEXES
// ============================================================
const phase1Commands = [
  // VACUUM & ANALYZE
  'VACUUM ANALYZE public.customers',
  'VACUUM ANALYZE public.customer_profiles',
  'VACUUM ANALYZE public.allocations',
  'VACUUM ANALYZE public.booking_assignment_idempotency',
  'VACUUM ANALYZE public.capacity_outbox',
  'ANALYZE public.booking_slots',
  'ANALYZE public.booking_state_history',
  'ANALYZE public.audit_logs',
  'ANALYZE public.observability_events',
  'ANALYZE public.table_adjacencies',
  'ANALYZE public.zones',

  // CREATE INDEXES
  `CREATE INDEX IF NOT EXISTS idx_bookings_customer_id
     ON public.bookings (customer_id, booking_date DESC)`,

  `CREATE INDEX IF NOT EXISTS idx_bookings_active_today
     ON public.bookings (restaurant_id, booking_date)
     WHERE status IN ('confirmed', 'pending', 'checked_in')`,

  `CREATE INDEX IF NOT EXISTS idx_allocations_booking
     ON public.allocations (booking_id)
     WHERE booking_id IS NOT NULL`,

  `CREATE INDEX IF NOT EXISTS idx_allocations_booking_id
     ON public.allocations (booking_id)`,

  `CREATE INDEX IF NOT EXISTS idx_booking_state_history_booking_id
     ON public.booking_state_history (booking_id)`,

  `CREATE INDEX IF NOT EXISTS idx_capacity_outbox_pending
     ON public.capacity_outbox (status, next_attempt_at)
     WHERE status = 'pending'`,

  `CREATE INDEX IF NOT EXISTS idx_scheduled_emails_pending
     ON public.scheduled_emails (status, scheduled_for)
     WHERE status = 'pending'`,
];

// ============================================================
// PHASE 2: AUTOVACUUM CONFIGURATION
// ============================================================
const phase2Commands = [
  `ALTER TABLE public.booking_state_history SET (
        autovacuum_vacuum_scale_factor = 0.02,
        autovacuum_analyze_scale_factor = 0.01
    )`,
  `ALTER TABLE public.allocations SET (
        autovacuum_vacuum_scale_factor = 0.05,
        autovacuum_analyze_scale_factor = 0.02
    )`,
  `ALTER TABLE public.table_holds SET (
        autovacuum_vacuum_scale_factor = 0.05,
        autovacuum_analyze_scale_factor = 0.02
    )`,
  `ALTER TABLE public.capacity_outbox SET (
        autovacuum_vacuum_scale_factor = 0.05,
        autovacuum_analyze_scale_factor = 0.02
    )`,
  `ALTER TABLE public.observability_events SET (
        autovacuum_vacuum_scale_factor = 0.1,
        autovacuum_analyze_scale_factor = 0.05
    )`,
  `ALTER TABLE public.customers SET (
        autovacuum_vacuum_scale_factor = 0.05,
        autovacuum_analyze_scale_factor = 0.02
    )`,
  `ALTER TABLE public.customer_profiles SET (
        autovacuum_vacuum_scale_factor = 0.05,
        autovacuum_analyze_scale_factor = 0.02
    )`,
  `ALTER TABLE public.booking_table_assignments SET (
        autovacuum_vacuum_scale_factor = 0.05,
        autovacuum_analyze_scale_factor = 0.02
    )`,
  `ALTER TABLE public.bookings SET (
        autovacuum_vacuum_scale_factor = 0.05,
        autovacuum_analyze_scale_factor = 0.02
    )`,
];

// ============================================================
// PHASE 3: FOREIGN KEY CHECKS
// ============================================================
const phase3CheckCommands = [
  {
    name: 'orphaned_booking_state_history',
    sql: `SELECT COUNT(*) AS count FROM public.booking_state_history bsh
              WHERE NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = bsh.booking_id)`,
  },
  {
    name: 'orphaned_customer_profiles',
    sql: `SELECT COUNT(*) AS count FROM public.customer_profiles cp
              WHERE NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = cp.customer_id)`,
  },
  {
    name: 'orphaned_booking_table_assignments',
    sql: `SELECT COUNT(*) AS count FROM public.booking_table_assignments bta
              WHERE NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = bta.booking_id)`,
  },
  {
    name: 'orphaned_allocations',
    sql: `SELECT COUNT(*) AS count FROM public.allocations a
              WHERE a.booking_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = a.booking_id)`,
  },
];

// ============================================================
// PHASE 4: CLEANUP ORPHANED DATA
// ============================================================
const phase4CleanupCommands = [
  `DELETE FROM public.booking_state_history
     WHERE NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id)`,

  `DELETE FROM public.allocations
     WHERE booking_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id)`,
];

// ============================================================
// PHASE 5: CREATE FOREIGN KEY CONSTRAINTS
// ============================================================
const phase5FkCommands = [
  `ALTER TABLE public.booking_state_history
     DROP CONSTRAINT IF EXISTS booking_state_history_booking_id_fkey,
     ADD CONSTRAINT booking_state_history_booking_id_fkey 
     FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE`,

  `ALTER TABLE public.customer_profiles
     DROP CONSTRAINT IF EXISTS customer_profiles_customer_id_fkey,
     ADD CONSTRAINT customer_profiles_customer_id_fkey 
     FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE`,

  `ALTER TABLE public.booking_table_assignments
     DROP CONSTRAINT IF EXISTS booking_table_assignments_booking_id_fkey,
     ADD CONSTRAINT booking_table_assignments_booking_id_fkey 
     FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE`,

  `ALTER TABLE public.allocations
     DROP CONSTRAINT IF EXISTS allocations_booking_id_fkey,
     ADD CONSTRAINT allocations_booking_id_fkey 
     FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL`,
];

// ============================================================
// VERIFICATION QUERIES
// ============================================================
const verificationQueries = [
  {
    name: 'indexes_created',
    sql: `SELECT indexname, tablename, pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
              FROM pg_indexes
              WHERE schemaname = 'public'
              AND indexname IN (
                  'idx_bookings_customer_id', 
                  'idx_bookings_active_today', 
                  'idx_allocations_booking',
                  'idx_allocations_booking_id',
                  'idx_booking_state_history_booking_id',
                  'idx_capacity_outbox_pending',
                  'idx_scheduled_emails_pending'
              )
              ORDER BY tablename, indexname`,
  },
  {
    name: 'autovacuum_configured',
    sql: `SELECT c.relname AS table_name,
                     pg_catalog.array_to_string(c.reloptions, ', ') AS settings
              FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public'
              AND c.reloptions IS NOT NULL
              AND c.relkind = 'r'
              ORDER BY c.relname`,
  },
  {
    name: 'bloat_check',
    sql: `SELECT relname AS table_name, n_live_tup, n_dead_tup,
                     round(100.0 * n_dead_tup / NULLIF(n_live_tup, 0), 2) AS dead_pct
              FROM pg_stat_user_tables
              WHERE schemaname = 'public' AND n_live_tup > 10
              ORDER BY dead_pct DESC NULLS LAST
              LIMIT 10`,
  },
];

async function runPhase(
  client: Client,
  phaseName: string,
  commands: string[],
): Promise<PhaseResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let successCount = 0;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`PHASE: ${phaseName}`);
  console.log(`${'='.repeat(60)}`);

  for (const cmd of commands) {
    const cmdPreview = cmd.replace(/\s+/g, ' ').substring(0, 80);
    try {
      await client.query(cmd);
      console.log(`  ✅ ${cmdPreview}...`);
      successCount++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ ${cmdPreview}...`);
      console.log(`     Error: ${errorMessage}`);
      errors.push(`${cmdPreview}: ${errorMessage}`);
    }
  }

  const duration = Date.now() - startTime;
  console.log(`\n  Completed: ${successCount}/${commands.length} commands in ${duration}ms`);

  return {
    phase: phaseName,
    success: errors.length === 0,
    commands: commands.length,
    errors,
    duration,
  };
}

function assertPhaseSucceeded(result: PhaseResult): void {
  if (!result.success) {
    throw new Error(`Schema optimization failed in phase: ${result.phase}`);
  }
}

async function main() {
  const stagingProjectRef = assertStagingScriptSafety({
    connectionString,
    expectedProjectRef:
      process.env.EXPECTED_PROJECT_REF ?? process.env.EXPECTED_STAGING_PROJECT_REF,
    targetEnv: process.env.DB_TARGET_ENV?.trim() || process.env.APP_ENV?.trim(),
    confirmation: process.env.CONFIRM_STAGING_SCHEMA_OPTIMIZATION,
    confirmationName: 'CONFIRM_STAGING_SCHEMA_OPTIMIZATION',
  });

  const client = new Client({
    connectionString,
    ssl: getPgSslConfig(),
  });

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     NABATABLE DATABASE SCHEMA OPTIMIZATION SCRIPT        ║');
  console.log('║                   nabatable-staging                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Guarded staging project ref: ${stagingProjectRef}`);
  console.log('');

  try {
    console.log(`🔌 Connecting to aws-1-eu-west-2.pooler.supabase.com...`);
    await client.connect();
    console.log('✅ Connected to database\n');

    const results: PhaseResult[] = [];

    // ============================================================
    // PHASE 1: VACUUM, ANALYZE & CREATE INDEXES
    // ============================================================
    let result = await runPhase(client, '1. VACUUM, ANALYZE & CREATE INDEXES', phase1Commands);
    results.push(result);
    assertPhaseSucceeded(result);

    // ============================================================
    // PHASE 2: AUTOVACUUM CONFIGURATION
    // ============================================================
    result = await runPhase(client, '2. AUTOVACUUM CONFIGURATION', phase2Commands);
    results.push(result);
    assertPhaseSucceeded(result);

    // ============================================================
    // PHASE 3: CHECK FOR ORPHANED DATA
    // ============================================================
    console.log(`\n${'='.repeat(60)}`);
    console.log('PHASE: 3. CHECK FOR ORPHANED DATA (FK prerequisite)');
    console.log(`${'='.repeat(60)}`);

    let orphanedDataFound = false;
    let orphanedCheckFailed = false;
    for (const check of phase3CheckCommands) {
      try {
        const result = await client.query(check.sql);
        const count = parseInt(result.rows[0]?.count || '0', 10);
        if (count > 0) {
          console.log(`  ⚠️  ${check.name}: ${count} orphaned records`);
          orphanedDataFound = true;
        } else {
          console.log(`  ✅ ${check.name}: 0 orphaned records`);
        }
      } catch (err) {
        console.log(`  ❌ ${check.name}: ${err}`);
        orphanedCheckFailed = true;
      }
    }
    if (orphanedCheckFailed) {
      throw new Error('Schema optimization failed while checking orphaned data.');
    }

    // ============================================================
    // PHASE 4: CLEANUP ORPHANED DATA
    // ============================================================
    if (orphanedDataFound) {
      result = await runPhase(client, '4. CLEANUP ORPHANED DATA', phase4CleanupCommands);
      results.push(result);
      assertPhaseSucceeded(result);
    } else {
      console.log('\n  ℹ️ No orphaned data to clean up.');
    }

    // ============================================================
    // PHASE 5: CREATE FOREIGN KEY CONSTRAINTS
    // ============================================================
    result = await runPhase(client, '5. CREATE FOREIGN KEY CONSTRAINTS', phase5FkCommands);
    results.push(result);
    assertPhaseSucceeded(result);

    // ============================================================
    // VERIFICATION
    // ============================================================
    console.log(`\n${'='.repeat(60)}`);
    console.log('VERIFICATION');
    console.log(`${'='.repeat(60)}`);

    for (const query of verificationQueries) {
      try {
        console.log(`\n📊 ${query.name}:`);
        const result = await client.query(query.sql);
        if (result.rows.length === 0) {
          console.log('   (no results)');
        } else {
          // Print as table
          console.table(result.rows);
        }
      } catch (err) {
        console.log(`   ❌ Error: ${err}`);
      }
    }

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(60)}`);

    let totalSuccess = 0;
    let totalCommands = 0;
    let totalErrors = 0;

    for (const result of results) {
      const status = result.success ? '✅' : '⚠️';
      console.log(
        `  ${status} ${result.phase}: ${result.commands - result.errors.length}/${result.commands} commands (${result.duration}ms)`,
      );
      totalSuccess += result.commands - result.errors.length;
      totalCommands += result.commands;
      totalErrors += result.errors.length;
    }

    console.log(`\n  Total: ${totalSuccess}/${totalCommands} commands successful`);
    if (totalErrors > 0) {
      console.log(`  Errors: ${totalErrors}`);
      throw new Error(`Schema optimization failed with ${totalErrors} command error(s).`);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('NEXT STEPS');
    console.log(`${'='.repeat(60)}`);
    console.log('  1. Review verification results above');
    console.log('  2. If orphaned data exists, clean it up manually');
    console.log('  3. Add FK constraints using schema-fixes-20260106.sql Phase 3');
    console.log('  4. Run weekly monitoring queries from maintenance-sql-20260106.sql');
    console.log('');
  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Disconnected from database');
  }
}

void main().catch((error) => {
  console.error(
    '[run-schema-optimization] Failed:',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
