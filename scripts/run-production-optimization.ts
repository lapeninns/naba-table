/**
 * 🚀 PRODUCTION Database Schema Optimization Script
 *
 * SAFE FOR LIVE PRODUCTION USE:
 * - Uses CREATE INDEX CONCURRENTLY (zero locking for writes)
 * - Uses NOT VALID / VALIDATE for Foreign Keys (minimal locking)
 * - Sequential execution for monitoring
 *
 * Run with:
 *   DB_URL="your_prod_uri" npx tsx scripts/run-production-optimization.ts
 */

import { Client } from 'pg';
import { getPgSslConfig } from './db/pg-ssl';
import {
  DEFAULT_PRODUCTION_PROJECT_REF,
  assertProductionScriptSafety,
  normalizeSupabaseProjectRef,
} from './db/safety';

const connectionString = process.env.DB_URL;

if (!connectionString) {
  console.error('❌ ERROR: Missing DB_URL environment variable.');
  console.error(
    '   Usage: DB_URL="postgresql://..." npx tsx scripts/run-production-optimization.ts',
  );
  process.exit(1);
}
const checkedConnectionString = connectionString;

interface PhaseResult {
  phase: string;
  success: boolean;
  commands: number;
  errors: string[];
  duration: number;
}

type CommandGroup = {
  name: string;
  commands: string[];
};

// ============================================================
// PHASE 1: MAINTENANCE (ANALYZE ONLY - SAFE FOR PROD)
// ============================================================
// We skip VACUUM for prod to minimize I/O spikes unless absolutely needed.
// ANALYZE is very fast and updates stats for the planner.
const phase1Commands = [
  'ANALYZE public.customers',
  'ANALYZE public.customer_profiles',
  'ANALYZE public.allocations',
  'ANALYZE public.booking_assignment_idempotency',
  'ANALYZE public.capacity_outbox',
  'ANALYZE public.booking_slots',
  'ANALYZE public.booking_state_history',
  'ANALYZE public.audit_logs',
  'ANALYZE public.observability_events',
];

// ============================================================
// PHASE 2: CONCURRENT INDEXES (ZERO LOCKING)
// ============================================================
const phase2Commands = [
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_customer_id
     ON public.bookings (customer_id, booking_date DESC)`,

  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_active_today
     ON public.bookings (restaurant_id, booking_date)
     WHERE status IN ('confirmed', 'pending', 'checked_in')`,

  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_allocations_booking
     ON public.allocations (booking_id)
     WHERE booking_id IS NOT NULL`,

  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_allocations_booking_id
     ON public.allocations (booking_id)`,

  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_state_history_booking_id
     ON public.booking_state_history (booking_id)`,

  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_capacity_outbox_pending
     ON public.capacity_outbox (status, next_attempt_at)
     WHERE status = 'pending'`,

  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_emails_pending
     ON public.scheduled_emails (status, scheduled_for)
     WHERE status = 'pending'`,
];

// ============================================================
// PHASE 3: AUTOVACUUM CONFIGURATION
// ============================================================
const phase3Commands = [
  `ALTER TABLE public.booking_state_history SET (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.01)`,
  `ALTER TABLE public.allocations SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02)`,
  `ALTER TABLE public.table_holds SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02)`,
  `ALTER TABLE public.capacity_outbox SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02)`,
  `ALTER TABLE public.observability_events SET (autovacuum_vacuum_scale_factor = 0.1, autovacuum_analyze_scale_factor = 0.05)`,
  `ALTER TABLE public.customers SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02)`,
  `ALTER TABLE public.customer_profiles SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02)`,
  `ALTER TABLE public.booking_table_assignments SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02)`,
  `ALTER TABLE public.bookings SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02)`,
];

// ============================================================
// PHASE 4: SAFE FOREIGN KEYS (ADD NOT VALID -> VALIDATE)
// ============================================================
const phase4FkCommandGroups: CommandGroup[] = [
  // 1. booking_state_history
  {
    name: 'booking_state_history_booking_id_fkey',
    commands: [
      `ALTER TABLE public.booking_state_history DROP CONSTRAINT IF EXISTS booking_state_history_booking_id_fkey`,
      `ALTER TABLE public.booking_state_history ADD CONSTRAINT booking_state_history_booking_id_fkey
         FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE NOT VALID`,
      `ALTER TABLE public.booking_state_history VALIDATE CONSTRAINT booking_state_history_booking_id_fkey`,
    ],
  },

  // 2. customer_profiles
  {
    name: 'customer_profiles_customer_id_fkey',
    commands: [
      `ALTER TABLE public.customer_profiles DROP CONSTRAINT IF EXISTS customer_profiles_customer_id_fkey`,
      `ALTER TABLE public.customer_profiles ADD CONSTRAINT customer_profiles_customer_id_fkey
         FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE NOT VALID`,
      `ALTER TABLE public.customer_profiles VALIDATE CONSTRAINT customer_profiles_customer_id_fkey`,
    ],
  },

  // 3. allocations
  {
    name: 'allocations_booking_id_fkey',
    commands: [
      `ALTER TABLE public.allocations DROP CONSTRAINT IF EXISTS allocations_booking_id_fkey`,
      `ALTER TABLE public.allocations ADD CONSTRAINT allocations_booking_id_fkey
         FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL NOT VALID`,
      `ALTER TABLE public.allocations VALIDATE CONSTRAINT allocations_booking_id_fkey`,
    ],
  },
];

function requireProductionTarget(): string {
  const expectedProjectRef = normalizeSupabaseProjectRef(
    process.env.EXPECTED_PROJECT_REF ??
      process.env.PRODUCTION_SUPABASE_PROJECT_REF ??
      DEFAULT_PRODUCTION_PROJECT_REF,
    'EXPECTED_PROJECT_REF',
  );

  assertProductionScriptSafety({
    connectionString: checkedConnectionString,
    expectedProjectRef,
    targetEnv: process.env.DB_TARGET_ENV?.trim() || process.env.APP_ENV?.trim(),
    requireTargetEnv: true,
    apply: true,
    destructive: true,
    confirmation: process.env.CONFIRM_PRODUCTION_OPTIMIZATION,
    confirmationName: 'CONFIRM_PRODUCTION_OPTIMIZATION',
    breakGlass: process.env.CONFIRM_PRODUCTION_DDL,
    breakGlassName: 'CONFIRM_PRODUCTION_DDL',
  });

  return expectedProjectRef;
}

async function runPhase(
  client: Client,
  phaseName: string,
  commands: string[],
): Promise<PhaseResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`PHASE: ${phaseName}`);
  console.log(`${'='.repeat(60)}`);

  for (const cmd of commands) {
    const cmdPreview = cmd.replace(/\s+/g, ' ').substring(0, 80);
    try {
      await client.query(cmd);
      console.log(`  ✅ ${cmdPreview}...`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ ${cmdPreview}...`);
      console.log(`     Error: ${errorMessage}`);
      errors.push(`${cmdPreview}: ${errorMessage}`);
    }
  }

  const duration = Date.now() - startTime;
  return {
    phase: phaseName,
    success: errors.length === 0,
    commands: commands.length,
    errors,
    duration,
  };
}

async function runTransactionalPhase(
  client: Client,
  phaseName: string,
  groups: CommandGroup[],
): Promise<PhaseResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`PHASE: ${phaseName}`);
  console.log(`${'='.repeat(60)}`);

  for (const group of groups) {
    try {
      await client.query('BEGIN');
      for (const cmd of group.commands) {
        await client.query(cmd);
      }
      await client.query('COMMIT');
      console.log(`  ✅ ${group.name}`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ ${group.name}`);
      console.log(`     Error: ${errorMessage}`);
      errors.push(`${group.name}: ${errorMessage}`);
      break;
    }
  }

  const duration = Date.now() - startTime;
  return {
    phase: phaseName,
    success: errors.length === 0,
    commands: groups.length,
    errors,
    duration,
  };
}

async function main() {
  const productionProjectRef = requireProductionTarget();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║    🚀 NABATABLE PRODUCTION DATABASE OPTIMIZATION         ║');
  console.log('║             (ZERO-DOWNTIME SAFE MODE)                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Guarded production project ref: ${productionProjectRef}`);

  const client = new Client({
    connectionString: checkedConnectionString,
    ssl: getPgSslConfig(),
  });

  try {
    console.log('\n🔌 Connecting to PRODUCTION database...');
    await client.connect();
    console.log('✅ High-five! We are connected to production.');

    const results: PhaseResult[] = [];

    // 1. Maintenance
    results.push(await runPhase(client, '1. MAINTENANCE (STATS)', phase1Commands));

    // 2. Concurrent Indexes
    console.log('\n⏳ BUILDING INDEXES CONCURRENTLY... (This may take a few minutes)');
    results.push(await runPhase(client, '2. CONCURRENT INDEXES', phase2Commands));

    // 3. Autovacuum
    results.push(await runPhase(client, '3. AUTOVACUUM CONFIG', phase3Commands));

    // 4. Foreign Keys
    results.push(
      await runTransactionalPhase(client, '4. SAFE FOREIGN KEYS', phase4FkCommandGroups),
    );

    // Final Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('🏁 PRODUCTION OPTIMIZATION COMPLETE');
    console.log(`${'='.repeat(60)}`);

    for (const res of results) {
      const status = res.success ? '✅' : '⚠️';
      console.log(
        `  ${status} ${res.phase}: ${res.commands - res.errors.length}/${res.commands} OK (${res.duration}ms)`,
      );
    }

    const failedPhases = results.filter((res) => !res.success);
    if (failedPhases.length > 0) {
      throw new Error(
        `Production optimization failed in phase(s): ${failedPhases
          .map((res) => res.phase)
          .join(', ')}`,
      );
    }
  } catch (err) {
    console.error('\n❌ FATAL PRODUCTION ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected. Fly safe!');
  }
}

void main().catch((error) => {
  console.error(
    '[run-production-optimization] Failed:',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
