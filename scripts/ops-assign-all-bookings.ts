/**
 * PRODUCTION-GRADE BULK ASSIGNMENT SCRIPT
 * 
 * Goals:
 * 1. Super fast processing with intelligent batching
 * 2. Guarantee all bookings get tables (with fallbacks)
 * 3. Zero errors via retry logic and conflict resolution
 * 
 * Strategy:
 * - Process in time-order to avoid conflicts
 * - Smart retry with exponential backoff
 * - Automatic conflict resolution
 * - Progressive relaxation of constraints if needed
 * 
 * Usage:
 *   pnpm tsx -r tsconfig-paths/register scripts/ops-assign-all-bookings.ts
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

// Load env BEFORE any imports
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

// Enable features
process.env.FEATURE_AUTO_ASSIGN_ON_BOOKING = 'true';
process.env.SUPPRESS_EMAILS = process.env.SUPPRESS_EMAILS ?? 'true';

import { DateTime } from 'luxon';
import fs from 'node:fs/promises';
import path from 'node:path';

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  TARGET_RESTAURANT_SLUG: process.env.TARGET_RESTAURANT_SLUG || 'white-horse-pub-waterbeach',
  
  // PERFORMANCE: Process sequentially by time to avoid conflicts
  BATCH_SIZE: 5,  // Process 5 at a time within same time slot
  
  // RELIABILITY: Aggressive retries
  MAX_RETRIES: 5,
  RETRY_DELAY_MS: 500,
  BACKOFF_MULTIPLIER: 1.5,
  
  // PROGRESSIVE RELAXATION: Relax constraints if needed
  ALLOW_NON_ADJACENT_FALLBACK: true,
  ALLOW_ZONE_MIXING_FALLBACK: false,  // Keep strict zone rules
  
  // HOLD SETTINGS
  HOLD_TTL_SECONDS: 300,  // 5 minutes for safety
  
  // REPORTING
  VERBOSE: true,
};

// ============================================================
// TYPES
// ============================================================

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  party_size: number;
  status: string;
  customer_name?: string;
}

interface AssignmentResult {
  bookingId: string;
  date: string;
  time: string;
  party: number;
  success: boolean;
  attempt: number;
  tables: string[];
  reason?: string;
  durationMs: number;
}

interface Report {
  executedAt: string;
  restaurant: string;
  totalBookings: number;
  successful: number;
  failed: number;
  successRate: number;
  totalDurationSeconds: number;
  results: AssignmentResult[];
  failedBookings: Array<{
    id: string;
    date: string;
    time: string;
    party: number;
    reason: string;
  }>;
}

// ============================================================
// UTILITIES
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function groupByTimeSlot(bookings: Booking[]): Map<string, Booking[]> {
  const groups = new Map<string, Booking[]>();
  
  for (const booking of bookings) {
    const key = `${booking.booking_date}|${booking.start_time}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(booking);
  }
  
  return groups;
}

// ============================================================
// ASSIGNMENT LOGIC
// ============================================================

async function assignBookingWithRetry(
  supabase: any,
  quoteTablesForBooking: any,
  confirmHoldAssignment: any,
  booking: Booking,
  attempt: number = 1
): Promise<AssignmentResult> {
  const start = Date.now();
  const maxRetries = CONFIG.MAX_RETRIES;
  
  try {
    // Progressive constraint relaxation
    const requireAdjacency = attempt <= 3 ? undefined : false;  // Relax after 3 attempts
    const maxTables = attempt <= 2 ? undefined : 5;  // Allow more tables after 2 attempts
    
    // Get quote
    const quote = await quoteTablesForBooking({
      bookingId: booking.id,
      createdBy: 'bulk-assign-script',
      holdTtlSeconds: CONFIG.HOLD_TTL_SECONDS,
      requireAdjacency,
      maxTables,
    });
    
    if (!quote.hold) {
      // No tables available - retry with backoff
      if (attempt < maxRetries) {
        const delay = CONFIG.RETRY_DELAY_MS * Math.pow(CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
        if (CONFIG.VERBOSE) {
          console.log(`  ⏳ Retry ${attempt + 1}/${maxRetries} for ${booking.id.slice(0, 8)} after ${delay}ms...`);
        }
        await sleep(delay);
        return assignBookingWithRetry(supabase, quoteTablesForBooking, confirmHoldAssignment, booking, attempt + 1);
      }
      
      return {
        bookingId: booking.id,
        date: booking.booking_date,
        time: booking.start_time,
        party: booking.party_size,
        success: false,
        attempt,
        tables: [],
        reason: quote.reason || 'No tables available after all retries',
        durationMs: Date.now() - start,
      };
    }
    
    // Confirm hold
    await confirmHoldAssignment({
      holdId: quote.hold.id,
      bookingId: booking.id,
      idempotencyKey: `bulk-assign-${booking.id}-${attempt}`,
      assignedBy: null,
    });
    
    // Transition to confirmed
    const nowIso = new Date().toISOString();
    const { error: transitionError } = await supabase.rpc('apply_booking_state_transition', {
      p_booking_id: booking.id,
      p_status: 'confirmed',
      p_checked_in_at: null,
      p_checked_out_at: null,
      p_updated_at: nowIso,
      p_history_from: booking.status,
      p_history_to: 'confirmed',
      p_history_changed_by: null,
      p_history_changed_at: nowIso,
      p_history_reason: 'bulk_assignment_script',
      p_history_metadata: { holdId: quote.hold.id, attempt },
    });
    
    if (transitionError) {
      // Transition failed - retry
      if (attempt < maxRetries) {
        const delay = CONFIG.RETRY_DELAY_MS * Math.pow(CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
        if (CONFIG.VERBOSE) {
          console.log(`  ⏳ Transition failed, retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        }
        await sleep(delay);
        return assignBookingWithRetry(supabase, quoteTablesForBooking, confirmHoldAssignment, booking, attempt + 1);
      }
      
      return {
        bookingId: booking.id,
        date: booking.booking_date,
        time: booking.start_time,
        party: booking.party_size,
        success: false,
        attempt,
        tables: [],
        reason: `Transition error: ${transitionError.message}`,
        durationMs: Date.now() - start,
      };
    }
    
    // Get assigned tables
    const { data: assignments } = await supabase
      .from('booking_table_assignments')
      .select('table_id, table:table_inventory(table_number)')
      .eq('booking_id', booking.id);
    
    const tables = (assignments || []).map((a: any) => a.table?.table_number || '?');
    
    // Verify final state
    const { data: finalBooking } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', booking.id)
      .maybeSingle();
    
    const success = finalBooking?.status === 'confirmed' && tables.length > 0;
    
    if (!success && attempt < maxRetries) {
      // Verification failed - retry
      const delay = CONFIG.RETRY_DELAY_MS * Math.pow(CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
      if (CONFIG.VERBOSE) {
        console.log(`  ⏳ Verification failed, retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
      }
      await sleep(delay);
      return assignBookingWithRetry(supabase, quoteTablesForBooking, confirmHoldAssignment, booking, attempt + 1);
    }
    
    return {
      bookingId: booking.id,
      date: booking.booking_date,
      time: booking.start_time,
      party: booking.party_size,
      success,
      attempt,
      tables,
      reason: success ? 'Assigned successfully' : 'Verification failed',
      durationMs: Date.now() - start,
    };
    
  } catch (error: any) {
    // Unexpected error - retry
    if (attempt < maxRetries) {
      const delay = CONFIG.RETRY_DELAY_MS * Math.pow(CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
      if (CONFIG.VERBOSE) {
        console.log(`  ⏳ Error occurred, retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
      }
      await sleep(delay);
      return assignBookingWithRetry(supabase, quoteTablesForBooking, confirmHoldAssignment, booking, attempt + 1);
    }
    
    return {
      bookingId: booking.id,
      date: booking.booking_date,
      time: booking.start_time,
      party: booking.party_size,
      success: false,
      attempt,
      tables: [],
      reason: `Exception: ${error.message || String(error)}`,
      durationMs: Date.now() - start,
    };
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const scriptStart = Date.now();
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 PRODUCTION BULK TABLE ASSIGNMENT                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Dynamic imports after env is loaded
  const supabaseModule = await import('@/server/supabase');
  const tablesModule = await import('@/server/capacity/tables');
  const getServiceSupabaseClient = supabaseModule.getServiceSupabaseClient;
  const quoteTablesForBooking = tablesModule.quoteTablesForBooking;
  const confirmHoldAssignment = tablesModule.confirmHoldAssignment;
  
  const supabase = getServiceSupabaseClient();
  
  // Get restaurant
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('slug', CONFIG.TARGET_RESTAURANT_SLUG)
    .single();
  
  if (!restaurant) throw new Error('Restaurant not found');
  
  console.log(`📍 Restaurant: ${restaurant.name}`);
  console.log(`🔧 Configuration:`);
  console.log(`   - Batch size: ${CONFIG.BATCH_SIZE}`);
  console.log(`   - Max retries: ${CONFIG.MAX_RETRIES}`);
  console.log(`   - Hold TTL: ${CONFIG.HOLD_TTL_SECONDS}s\n`);
  
  // Get all pending bookings across all dates
  const { data: allBookings } = await supabase
    .from('bookings')
    .select('id, booking_date, start_time, party_size, status, customer_name')
    .eq('restaurant_id', restaurant.id)
    .eq('status', 'pending')
    .order('booking_date', { ascending: true })
    .order('start_time', { ascending: true });
  
  if (!allBookings || allBookings.length === 0) {
    console.log('✅ No pending bookings to process\n');
    return;
  }
  
  console.log(`📊 Found ${allBookings.length} pending bookings to process\n`);
  
  // Group by time slot to minimize conflicts
  const timeSlots = groupByTimeSlot(allBookings);
  console.log(`⏰ Processing ${timeSlots.size} time slots...\n`);
  
  const results: AssignmentResult[] = [];
  let processed = 0;
  
  // Process each time slot sequentially
  for (const [timeSlot, bookingsInSlot] of Array.from(timeSlots.entries()).sort()) {
    const [date, time] = timeSlot.split('|');
    console.log(`\n⏰ Time slot: ${date} ${time} (${bookingsInSlot.length} bookings)`);
    
    // Process bookings in this slot in small batches
    for (let i = 0; i < bookingsInSlot.length; i += CONFIG.BATCH_SIZE) {
      const batch = bookingsInSlot.slice(i, i + CONFIG.BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(booking => 
          assignBookingWithRetry(
            supabase,
            quoteTablesForBooking,
            confirmHoldAssignment,
            booking
          )
        )
      );
      
      // Display results
      for (const result of batchResults) {
        results.push(result);
        processed++;
        
        const icon = result.success ? '✅' : '❌';
        const progress = `[${processed}/${allBookings.length}]`;
        const info = result.success
          ? `${result.tables.join(', ')} (attempt ${result.attempt})`
          : `${result.reason} (attempt ${result.attempt})`;
        
        console.log(`  ${icon} ${progress} ${result.time} | party=${result.party} | ${info}`);
      }
      
      // Small delay between batches to avoid overwhelming the system
      if (i + CONFIG.BATCH_SIZE < bookingsInSlot.length) {
        await sleep(100);
      }
    }
  }
  
  const totalDuration = (Date.now() - scriptStart) / 1000;
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  // Generate report
  const report: Report = {
    executedAt: new Date().toISOString(),
    restaurant: restaurant.name,
    totalBookings: allBookings.length,
    successful,
    failed,
    successRate: Math.round((successful / allBookings.length) * 100),
    totalDurationSeconds: Math.round(totalDuration * 100) / 100,
    results,
    failedBookings: results
      .filter(r => !r.success)
      .map(r => ({
        id: r.bookingId,
        date: r.date,
        time: r.time,
        party: r.party,
        reason: r.reason || 'Unknown',
      })),
  };
  
  // Save report
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const reportsDir = path.join(process.cwd(), 'reports');
  await fs.mkdir(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, `bulk-assignment-${timestamp}.json`);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  📊 BULK ASSIGNMENT COMPLETE                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`  Restaurant: ${restaurant.name}`);
  console.log(`  Total bookings: ${allBookings.length}`);
  console.log(`  ✅ Successful: ${successful} (${report.successRate}%)`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏱️  Total time: ${totalDuration.toFixed(2)}s`);
  console.log(`  📁 Report: ${reportPath}\n`);
  
  // Show failures if any
  if (failed > 0) {
    console.log('❌ FAILED BOOKINGS:\n');
    report.failedBookings.forEach(fb => {
      console.log(`  ${fb.date} ${fb.time} | party=${fb.party}`);
      console.log(`  Reason: ${fb.reason}\n`);
    });
  } else {
    console.log('🎉 ALL BOOKINGS SUCCESSFULLY ASSIGNED!\n');
  }
}

main().catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
});
