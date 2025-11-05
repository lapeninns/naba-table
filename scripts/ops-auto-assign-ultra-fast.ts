/**
 * ULTRA-FAST Auto-Assignment Script
 * 
 * Performance Optimizations:
 * - Aggressive parallel processing (10+ concurrent operations)
 * - No retry delays (fail fast)
 * - Minimal logging overhead
 * - Batched database operations
 * - Connection pooling optimizations
 * 
 * Uses repository algorithms:
 * - quoteTablesForBooking() - intelligent table assignment
 * - confirmHoldAssignment() - hold confirmation
 * - apply_booking_state_transition RPC - atomic status updates
 * 
 * Usage:
 *   pnpm tsx -r tsconfig-paths/register scripts/ops-auto-assign-ultra-fast.ts
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

// Load env BEFORE any imports that depend on it
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

// Enable features
if (!process.env.FEATURE_AUTO_ASSIGN_ON_BOOKING) {
  process.env.FEATURE_AUTO_ASSIGN_ON_BOOKING = 'true';
}
process.env.SUPPRESS_EMAILS = process.env.SUPPRESS_EMAILS ?? 'true';

import { DateTime } from 'luxon';
import fs from 'node:fs/promises';
import path from 'node:path';

// ============================================================
// ULTRA-FAST CONFIGURATION
// ============================================================

const CONFIG = {
  TARGET_RESTAURANT_SLUG: process.env.TARGET_RESTAURANT_SLUG || 'prince-of-wales-pub-bromham',
  TARGET_DATE: process.env.TARGET_DATE || new Date().toISOString().split('T')[0],  // Today's date (YYYY-MM-DD)
  
  // PERFORMANCE SETTINGS
  MAX_CONCURRENT_BOOKINGS: parseInt(process.env.MAX_CONCURRENT_BOOKINGS || '15', 10),  // Process bookings simultaneously
  SINGLE_ATTEMPT_ONLY: true,    // No retries - fail fast
  HOLD_TTL_SECONDS: 180,
  
  // REPORTING
  MINIMAL_CONSOLE_OUTPUT: false,
  
  // FORCE REASSIGNMENT (ignore current status)
  FORCE_REASSIGN_ALL: false,  // Only process pending bookings
};

// ============================================================
// TYPES
// ============================================================

interface QuickResult {
  id: string;
  bookingId: string;
  time: string;
  party: number;
  statusBefore: string | null;
  statusAfter: string | null;
  success: boolean;
  reason: string | null;
  failureType: string | null;
  errorCode: string | null;
  rawError: string | null;
  transitionError: string | null;
  quoteReason: string | null;
  holdId: string | null;
  holdExpiresAt: string | null;
  tablesAssigned: string[];
  assignmentsPersisted: number | null;
  alternatesSuggested: number;
  skippedCandidates: number;
  durationMs: number;
}

interface FastReport {
  executedAt: string;
  restaurant: string;
  date: string;
  config: typeof CONFIG;
  totalBookings: number;
  pendingProcessed: number;
  successful: number;
  failed: number;
  successRate: number;
  totalDurationSeconds: number;
  avgProcessingMs: number;
  results: QuickResult[];
  persistedStatuses: Record<string, string | null>;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const scriptStart = Date.now();
  
  // Dynamic import after env is loaded
  const supabaseModule = await import('@/server/supabase');
  const tablesModule = await import('@/server/capacity/tables');
  const getServiceSupabaseClient = supabaseModule.getServiceSupabaseClient;
  const quoteTablesForBooking = tablesModule.quoteTablesForBooking;
  const confirmHoldAssignment = tablesModule.confirmHoldAssignment;
  
  // Ultra-fast assignment function (defined inside main to access imports)
  async function fastAssign(
    supabase: any,
    bookingId: string,
    bookingTime: string,
    partySize: number
  ): Promise<QuickResult> {
    const start = Date.now();
    const shortId = bookingId.slice(0, 8);
    const sanitizeError = (error: unknown): { code: string | null; message: string } => {
      if (!error) {
        return { code: null, message: "Unknown error" };
      }
      if (typeof error === "object" && error !== null) {
        const code = "code" in error && typeof (error as { code?: unknown }).code === "string"
          ? (error as { code?: string }).code!
          : null;
        const message = "message" in error && typeof (error as { message?: unknown }).message === "string"
          ? (error as { message?: string }).message!
          : String(error);
        return { code, message };
      }
      return { code: null, message: String(error) };
    };

    const classifyFailure = (message: string | null): string | null => {
      if (!message) return null;
      const normalized = message.toLowerCase();
      if (normalized.includes("locked to zone")) return "zone_lock";
      if (normalized.includes("hold conflict")) return "hold_conflict";
      if (normalized.includes("capacity")) return "capacity";
      if (normalized.includes("adjacency")) return "adjacency";
      if (normalized.includes("timeout")) return "timeout";
      if (normalized.includes("duplicate")) return "idempotency";
      return "unknown";
    };

    try {
      const { data: before } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .maybeSingle();

      // Single attempt - no retries
      const requireAdjacencyOverride = process.env.ULTRA_REQUIRE_ADJACENCY
        ? String(process.env.ULTRA_REQUIRE_ADJACENCY).toLowerCase() === 'true'
        : undefined;
      const maxTablesOverride = process.env.ULTRA_MAX_TABLES
        ? Math.max(1, Math.min(Number(process.env.ULTRA_MAX_TABLES) || 1, 5))
        : undefined;

      const quote = await quoteTablesForBooking({
        bookingId,
        createdBy: 'ultra-fast-script',
        holdTtlSeconds: CONFIG.HOLD_TTL_SECONDS,
        requireAdjacency: requireAdjacencyOverride,
        maxTables: maxTablesOverride,
      });

      if (!quote.hold) {
        return {
          id: shortId,
          bookingId,
          time: bookingTime,
          party: partySize,
          statusBefore: before?.status ?? null,
          statusAfter: before?.status ?? null,
          success: false,
          reason: quote.reason || 'No hold',
          failureType: classifyFailure(quote.reason || null),
          errorCode: null,
          rawError: null,
          transitionError: null,
          quoteReason: quote.reason || null,
          holdId: null,
          holdExpiresAt: null,
          tablesAssigned: [],
          assignmentsPersisted: null,
          alternatesSuggested: quote.alternates.length,
          skippedCandidates: quote.skipped?.length ?? 0,
          durationMs: Date.now() - start,
        };
      }

      // Confirm hold
      await confirmHoldAssignment({
        holdId: quote.hold.id,
        bookingId,
        idempotencyKey: `ultra-fast-${bookingId}`,
        assignedBy: null,
      });

      // Transition to confirmed
      const { data: current } = await supabase
        .from('bookings')
        .select('status, assigned_zone_id')
        .eq('id', bookingId)
        .maybeSingle();

      const nowIso = new Date().toISOString();
      const { error: transitionError } = await supabase.rpc('apply_booking_state_transition', {
        p_booking_id: bookingId,
        p_status: 'confirmed',
        p_checked_in_at: null,
        p_checked_out_at: null,
        p_updated_at: nowIso,
        p_history_from: current?.status || before?.status || 'pending',
        p_history_to: 'confirmed',
        p_history_changed_by: null,
        p_history_changed_at: nowIso,
        p_history_reason: 'ultra_fast_script',
        p_history_metadata: { holdId: quote.hold.id },
      });

      if (transitionError) {
        const { code, message } = sanitizeError(transitionError);
        return {
          id: shortId,
          bookingId,
          time: bookingTime,
          party: partySize,
          statusBefore: before?.status ?? null,
          statusAfter: current?.status ?? null,
          success: false,
          reason: message,
          failureType: classifyFailure(message),
          errorCode: code,
          rawError: message,
          transitionError: message,
          quoteReason: quote.reason || null,
          holdId: quote.hold.id,
          holdExpiresAt: quote.hold.expiresAt,
          tablesAssigned: [],
          assignmentsPersisted: null,
          alternatesSuggested: quote.alternates.length,
          skippedCandidates: quote.skipped?.length ?? 0,
          durationMs: Date.now() - start,
        };
      }

      // Get assigned tables
      const { data: assignments, error: assignmentsError } = await supabase
        .from('booking_table_assignments')
        .select('table_id, table:table_inventory(table_number)')
        .eq('booking_id', bookingId);

      if (assignmentsError) {
        const { code, message } = sanitizeError(assignmentsError);
        return {
          id: shortId,
          bookingId,
          time: bookingTime,
          party: partySize,
          statusBefore: before?.status ?? null,
          statusAfter: 'confirmed',
          success: false,
          reason: message,
          failureType: classifyFailure(message),
          errorCode: code,
          rawError: message,
          transitionError: null,
          quoteReason: quote.reason || null,
          holdId: quote.hold.id,
          holdExpiresAt: quote.hold.expiresAt,
          tablesAssigned: [],
          assignmentsPersisted: null,
          alternatesSuggested: quote.alternates.length,
          skippedCandidates: quote.skipped?.length ?? 0,
          durationMs: Date.now() - start,
        };
      }

      const tables = (assignments || []).map((a: any) => a.table?.table_number || '?');
      const assignmentsPersisted = assignments ? assignments.length : 0;

      const { data: after } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .maybeSingle();

      const statusAfter = after?.status ?? 'unknown';
      const success = statusAfter === 'confirmed' && assignmentsPersisted > 0;
      const successReason = success ? 'Assigned' : 'Confirmed without persistence';

      return {
        id: shortId,
        bookingId,
        time: bookingTime,
        party: partySize,
        statusBefore: before?.status ?? null,
        statusAfter,
        success,
        reason: successReason,
        failureType: success ? null : 'persistence',
        errorCode: null,
        rawError: null,
        transitionError: null,
        quoteReason: quote.reason || null,
        holdId: quote.hold.id,
        holdExpiresAt: quote.hold.expiresAt,
        tablesAssigned: tables,
        assignmentsPersisted,
        alternatesSuggested: quote.alternates.length,
        skippedCandidates: quote.skipped?.length ?? 0,
        durationMs: Date.now() - start,
      };

    } catch (error: any) {
      const { code, message } = sanitizeError(error);
      return {
        id: shortId,
        bookingId,
        time: bookingTime,
        party: partySize,
        statusBefore: null,
        statusAfter: null,
        success: false,
        reason: message || 'Error',
        failureType: classifyFailure(message || null),
        errorCode: code,
        rawError: message,
        transitionError: null,
        quoteReason: null,
        holdId: null,
        holdExpiresAt: null,
        tablesAssigned: [],
        assignmentsPersisted: null,
        alternatesSuggested: 0,
        skippedCandidates: 0,
        durationMs: Date.now() - start,
      };
    }
  }
  
  if (!CONFIG.MINIMAL_CONSOLE_OUTPUT) {
    console.log('\n⚡ ULTRA-FAST AUTO-ASSIGNMENT SCRIPT');
    console.log(`📍 ${CONFIG.TARGET_RESTAURANT_SLUG} | ${CONFIG.TARGET_DATE}`);
    console.log(`🚀 Concurrent: ${CONFIG.MAX_CONCURRENT_BOOKINGS} | Single attempt only\n`);
  }

  const supabase = getServiceSupabaseClient();

  // Get restaurant
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('slug', CONFIG.TARGET_RESTAURANT_SLUG)
    .single();

  if (!restaurant) throw new Error('Restaurant not found');

  // Get bookings - query by booking_date column
  const { data: allBookings } = await supabase
    .from('bookings')
    .select('id, booking_date, start_time, party_size, status')
    .eq('restaurant_id', restaurant.id)
    .eq('booking_date', CONFIG.TARGET_DATE)
    .order('start_time', { ascending: true });

  // Choose which bookings to process
  const pending = (allBookings || []).filter((b: any) => b.status === 'pending');
  const toProcess = CONFIG.FORCE_REASSIGN_ALL ? (allBookings || []) : pending;

  if (!CONFIG.MINIMAL_CONSOLE_OUTPUT) {
    console.log(`📊 Found ${allBookings?.length || 0} bookings (${pending.length} pending)`);
    if (CONFIG.FORCE_REASSIGN_ALL) {
      console.log(`⚠️  FORCE MODE: Processing ALL ${toProcess.length} bookings (including confirmed)\n`);
    } else {
      console.log();
    }
  }

  if (toProcess.length === 0) {
    console.log('✅ No bookings to process\n');
    return;
  }

  // Process with aggressive parallelization
  if (!CONFIG.MINIMAL_CONSOLE_OUTPUT) {
    console.log(`⚡ Processing ${toProcess.length} bookings...`);
    console.log(`   ${CONFIG.MAX_CONCURRENT_BOOKINGS} at a time, no retries\n`);
  }

  const results: QuickResult[] = [];
  
  // Split into chunks for parallel processing
  for (let i = 0; i < toProcess.length; i += CONFIG.MAX_CONCURRENT_BOOKINGS) {
    const chunk = toProcess.slice(i, i + CONFIG.MAX_CONCURRENT_BOOKINGS);
    
    const chunkResults = await Promise.allSettled(
      chunk.map((b: any) => 
        fastAssign(
          supabase,
          b.id,
          b.start_time, // Time in HH:mm:ss format
          b.party_size
        )
      )
    );

    for (const result of chunkResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        
        if (!CONFIG.MINIMAL_CONSOLE_OUTPUT) {
          const icon = result.value.success ? '✅' : '❌';
          const tables = result.value.success 
            ? ` → tables=${result.value.tablesAssigned.join(',')}` 
            : ` → reason=${result.value.reason}`;
          const meta = result.value.success
            ? `status=${result.value.statusAfter}`
            : `failure=${result.value.failureType || 'unknown'} code=${result.value.errorCode ?? 'n/a'}`;
          console.log(`${icon} ${result.value.id} | ${result.value.time} | party=${result.value.party} | ${meta}${tables} (${result.value.durationMs}ms)`);
        }
      }
    }
  }

  const totalDuration = (Date.now() - scriptStart) / 1000;
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgMs = results.reduce((sum, r) => sum + r.durationMs, 0) / results.length;

  // Generate report
  // Verify persisted state for processed bookings
  const processedIds = results.map((r) => r.bookingId);
  const persistedStatuses: Record<string, string | null> = {};
  if (processedIds.length > 0) {
    const { data: persisted } = await supabase
      .from('bookings')
      .select('id, status')
      .in('id', processedIds);
    if (persisted) {
      for (const row of persisted) {
        persistedStatuses[row.id] = row.status;
      }
    }
  }

  const persistedConfirmed = Object.values(persistedStatuses).filter((status) => status === 'confirmed').length;

  const report: FastReport = {
    executedAt: new Date().toISOString(),
    restaurant: restaurant.name,
    date: CONFIG.TARGET_DATE,
    config: CONFIG,
    totalBookings: allBookings?.length || 0,
    pendingProcessed: toProcess.length,
    successful,
    failed,
    successRate: results.length > 0 ? Math.round(successful / results.length * 100) : 0,
    totalDurationSeconds: Math.round(totalDuration * 100) / 100,
    avgProcessingMs: Math.round(avgMs),
    results,
    persistedStatuses,
  };

  // Save report (optional). To disable writing, set ULTRA_WRITE_REPORTS=false
  const WRITE_REPORTS = String(process.env.ULTRA_WRITE_REPORTS ?? 'true').toLowerCase() !== 'false';
  let reportPath: string | null = null;
  if (WRITE_REPORTS) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const reportsDir = path.join(process.cwd(), 'reports');
    await fs.mkdir(reportsDir, { recursive: true });
    reportPath = path.join(
      reportsDir,
      `auto-assign-ultra-fast-${CONFIG.TARGET_DATE}-${timestamp}.json`
    );
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ⚡ ULTRA-FAST EXECUTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Restaurant: ${restaurant.name}`);
  console.log(`  Date: ${CONFIG.TARGET_DATE}`);
  console.log(`  Total bookings: ${report.totalBookings}`);
  console.log(`  Pending processed: ${results.length}`);
  console.log(`  ✅ Success (script reported): ${successful}`);
  console.log(`  ✅ Success (persisted confirmed): ${persistedConfirmed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  Success rate (script): ${report.successRate}%`);
  const persistedRate = results.length > 0 ? Math.round((persistedConfirmed / results.length) * 100) : 0;
  console.log(`  Success rate (persisted): ${persistedRate}%`);
  console.log(`  ⏱️  Total time: ${totalDuration.toFixed(2)}s`);
  console.log(`  ⚡ Avg per booking: ${report.avgProcessingMs}ms`);
  if (reportPath) {
    console.log(`  📁 Report: ${reportPath}`);
  } else {
    console.log(`  📁 Report writing disabled (ULTRA_WRITE_REPORTS=false)`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  // Failure breakdown
  if (failed > 0) {
    console.log('📊 FAILURE BREAKDOWN:\n');
    const failureReasons = results
      .filter(r => !r.success)
      .reduce((acc, r) => {
        const key = `${r.failureType || 'unknown'}::${r.reason || 'Unknown'}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    Object.entries(failureReasons)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        const [failureType, message] = reason.split('::');
        console.log(`  ${count}x - type=${failureType} message=${message}`);
      });
    console.log('');
  }

  // Success details
  if (successful > 0) {
    console.log(`✅ SUCCESSFUL ASSIGNMENTS (${successful}):\n`);
    results
      .filter(r => r.success)
      .forEach(r => {
        console.log(`  ${r.id} | ${r.time} | party=${r.party} | tables: ${r.tablesAssigned.join(', ')}`);
      });
    console.log('');
  }
}

main().catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  process.exit(1);
});
