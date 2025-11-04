/**
 * Comprehensive Auto-Assignment Script - Built from Scratch
 * 
 * Uses the actual repository algorithms:
 * - quoteTablesForBooking() for intelligent table assignment
 * - confirmHoldAssignment() for hold confirmation
 * - Booking state transitions via apply_booking_state_transition RPC
 * 
 * Features:
 * - Processes PENDING bookings only
 * - Multi-attempt strategy with retry logic
 * - Comprehensive diagnostics and reporting
 * - Parallel batch processing for performance
 * - Detailed success/failure tracking
 * 
 * Usage:
 *   pnpm tsx -r tsconfig-paths/register scripts/ops-auto-assign-comprehensive.ts
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';
import { writeFileSync } from 'fs';

// Load environment variables
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

// Enable features for script execution
if (!process.env.FEATURE_AUTO_ASSIGN_ON_BOOKING) {
  process.env.FEATURE_AUTO_ASSIGN_ON_BOOKING = 'true';
}
process.env.SUPPRESS_EMAILS = process.env.SUPPRESS_EMAILS ?? 'true';

import { getServiceSupabaseClient } from '@/server/supabase';
import { quoteTablesForBooking, confirmHoldAssignment } from '@/server/capacity/tables';
import { DateTime } from 'luxon';

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  TARGET_RESTAURANT_SLUG: 'prince-of-wales-pub-bromham',
  TARGET_DATE: '2025-11-09',
  PARALLEL_BATCH_SIZE: 3,
  MAX_ATTEMPTS_PER_BOOKING: 3,
  RETRY_DELAY_MS: 2000,
  HOLD_TTL_SECONDS: 180,
};

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface BookingInfo {
  id: string;
  restaurantId: string;
  datetime: string;
  partySize: number;
  status: string;
  customerEmail: string | null;
  customerName: string | null;
  reference: string | null;
}

interface AssignmentAttempt {
  attemptNumber: number;
  timestamp: string;
  success: boolean;
  holdCreated: boolean;
  holdId: string | null;
  tablesQuoted: number;
  reason: string | null;
  alternatesFound: number;
  nextTimesAvailable: number;
  errorMessage: string | null;
}

interface AssignmentResult {
  bookingId: string;
  bookingTime: string;
  partySize: number;
  initialStatus: string;
  finalStatus: string;
  success: boolean;
  attempts: AssignmentAttempt[];
  assignedTables: Array<{
    tableId: string;
    tableNumber: string;
  }> | null;
  totalProcessingTimeMs: number;
  failureReason: string | null;
}

interface ScriptReport {
  metadata: {
    scriptVersion: string;
    executionTimestamp: string;
    targetRestaurant: string;
    targetDate: string;
    configuration: typeof CONFIG;
    totalExecutionTimeSeconds: number;
  };
  summary: {
    totalBookingsFound: number;
    pendingBookingsProcessed: number;
    successfulAssignments: number;
    failedAssignments: number;
    successRate: number;
    totalAttempts: number;
    averageAttemptsPerBooking: number;
    averageProcessingTimeMs: number;
  };
  results: AssignmentResult[];
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getBookingsByDate(
  supabase: any,
  restaurantId: string,
  targetDate: string
): Promise<BookingInfo[]> {
  const startOfDay = DateTime.fromISO(targetDate).startOf('day').toISO();
  const endOfDay = DateTime.fromISO(targetDate).endOf('day').toISO();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      id,
      restaurant_id,
      datetime,
      party_size,
      status,
      customer_email,
      customer_name,
      reference
    `)
    .eq('restaurant_id', restaurantId)
    .gte('datetime', startOfDay)
    .lte('datetime', endOfDay)
    .order('datetime', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch bookings: ${error.message}`);
  }

  return (bookings || []).map((b: any) => ({
    id: b.id,
    restaurantId: b.restaurant_id,
    datetime: b.datetime,
    partySize: b.party_size,
    status: b.status,
    customerEmail: b.customer_email,
    customerName: b.customer_name,
    reference: b.reference,
  }));
}

async function getAssignedTables(
  supabase: any,
  bookingId: string
): Promise<Array<{ tableId: string; tableNumber: string }>> {
  const { data: assignments } = await supabase
    .from('booking_table_assignments')
    .select(`
      table_id,
      table:table_inventory(table_number)
    `)
    .eq('booking_id', bookingId);

  if (!assignments || assignments.length === 0) {
    return [];
  }

  return assignments.map((a: any) => ({
    tableId: a.table_id,
    tableNumber: a.table?.table_number || 'unknown',
  }));
}

// ============================================================
// CORE ASSIGNMENT LOGIC
// ============================================================

async function attemptAssignment(
  supabase: any,
  bookingId: string,
  attemptNumber: number
): Promise<AssignmentAttempt> {
  const timestamp = new Date().toISOString();
  
  console.log(`    [Attempt ${attemptNumber}] Requesting table quote...`);
  
  try {
    // Step 1: Quote tables using the repository's capacity engine
    const quoteResult = await quoteTablesForBooking({
      bookingId,
      createdBy: 'auto-assign-script',
      holdTtlSeconds: CONFIG.HOLD_TTL_SECONDS,
    });

    const holdCreated = quoteResult.hold !== null;
    const tablesQuoted = quoteResult.candidate?.tableIds?.length || 0;
    const alternatesFound = quoteResult.alternates?.length || 0;
    const nextTimesAvailable = quoteResult.nextTimes?.length || 0;

    console.log(`    [Attempt ${attemptNumber}] Quote result: hold=${holdCreated}, tables=${tablesQuoted}, alternates=${alternatesFound}`);

    if (!quoteResult.hold) {
      // No hold created - assignment failed
      return {
        attemptNumber,
        timestamp,
        success: false,
        holdCreated: false,
        holdId: null,
        tablesQuoted,
        reason: quoteResult.reason || 'No suitable tables available',
        alternatesFound,
        nextTimesAvailable,
        errorMessage: null,
      };
    }

    // Step 2: Confirm the hold to make it permanent
    console.log(`    [Attempt ${attemptNumber}] Confirming hold ${quoteResult.hold.id}...`);
    
    await confirmHoldAssignment({
      holdId: quoteResult.hold.id,
      bookingId,
      idempotencyKey: `auto-assign-${bookingId}-${attemptNumber}`,
      assignedBy: null,
    });

    // Step 3: Transition booking to confirmed status
    console.log(`    [Attempt ${attemptNumber}] Transitioning booking to confirmed...`);
    
    const nowIso = new Date().toISOString();
    const { data: currentBooking } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .single();

    const { error: txError } = await supabase.rpc('apply_booking_state_transition', {
      p_booking_id: bookingId,
      p_status: 'confirmed',
      p_checked_in_at: null,
      p_checked_out_at: null,
      p_updated_at: nowIso,
      p_history_from: currentBooking?.status || 'pending',
      p_history_to: 'confirmed',
      p_history_changed_by: null,
      p_history_changed_at: nowIso,
      p_history_reason: 'auto_assign_script',
      p_history_metadata: { 
        source: 'auto-assign-script',
        holdId: quoteResult.hold.id,
        attemptNumber,
      },
    });

    if (txError) {
      throw new Error(`State transition failed: ${txError.message}`);
    }

    console.log(`    [Attempt ${attemptNumber}] ✅ SUCCESS - Booking confirmed`);

    return {
      attemptNumber,
      timestamp,
      success: true,
      holdCreated: true,
      holdId: quoteResult.hold.id,
      tablesQuoted,
      reason: 'Successfully assigned and confirmed',
      alternatesFound,
      nextTimesAvailable,
      errorMessage: null,
    };

  } catch (error: any) {
    console.log(`    [Attempt ${attemptNumber}] ❌ ERROR: ${error.message}`);
    
    return {
      attemptNumber,
      timestamp,
      success: false,
      holdCreated: false,
      holdId: null,
      tablesQuoted: 0,
      reason: null,
      alternatesFound: 0,
      nextTimesAvailable: 0,
      errorMessage: error.message,
    };
  }
}

async function processBooking(
  supabase: any,
  booking: BookingInfo
): Promise<AssignmentResult> {
  const startTime = Date.now();
  const bookingTime = DateTime.fromISO(booking.datetime).toFormat('HH:mm');
  
  console.log(`\n╔════════════════════════════════════════════════════════╗`);
  console.log(`║ Booking ${booking.id.slice(0, 8)}...`);
  console.log(`║ Time: ${bookingTime} | Party: ${booking.partySize} | Status: ${booking.status}`);
  console.log(`╚════════════════════════════════════════════════════════╝`);

  const attempts: AssignmentAttempt[] = [];
  let success = false;
  let assignedTables: Array<{ tableId: string; tableNumber: string }> | null = null;
  let failureReason: string | null = null;

  // Multi-attempt strategy
  for (let attemptNum = 1; attemptNum <= CONFIG.MAX_ATTEMPTS_PER_BOOKING; attemptNum++) {
    const attempt = await attemptAssignment(supabase, booking.id, attemptNum);
    attempts.push(attempt);

    if (attempt.success) {
      success = true;
      // Get assigned tables
      assignedTables = await getAssignedTables(supabase, booking.id);
      break;
    }

    // If not successful and more attempts remain, wait before retry
    if (attemptNum < CONFIG.MAX_ATTEMPTS_PER_BOOKING) {
      console.log(`    ⏳ Waiting ${CONFIG.RETRY_DELAY_MS}ms before retry...`);
      await sleep(CONFIG.RETRY_DELAY_MS);
    } else {
      // Final attempt failed - capture reason
      failureReason = attempt.reason || attempt.errorMessage || 'All attempts exhausted';
    }
  }

  // Get final status
  const { data: finalBooking } = await supabase
    .from('bookings')
    .select('status')
    .eq('id', booking.id)
    .single();

  const totalProcessingTimeMs = Date.now() - startTime;

  if (success) {
    console.log(`\n✅ BOOKING ${booking.id.slice(0, 8)} - SUCCESS`);
    console.log(`   Tables: ${assignedTables?.map(t => t.tableNumber).join(', ')}`);
  } else {
    console.log(`\n❌ BOOKING ${booking.id.slice(0, 8)} - FAILED`);
    console.log(`   Reason: ${failureReason}`);
  }
  console.log(`   Processing time: ${totalProcessingTimeMs}ms\n`);

  return {
    bookingId: booking.id,
    bookingTime,
    partySize: booking.partySize,
    initialStatus: booking.status,
    finalStatus: finalBooking?.status || booking.status,
    success,
    attempts,
    assignedTables,
    totalProcessingTimeMs,
    failureReason,
  };
}

// ============================================================
// MAIN SCRIPT
// ============================================================

async function main() {
  const scriptStartTime = Date.now();
  
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  COMPREHENSIVE AUTO-ASSIGNMENT SCRIPT');
  console.log('  Built from scratch using repository algorithms');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  Restaurant: ${CONFIG.TARGET_RESTAURANT_SLUG}`);
  console.log(`  Date: ${CONFIG.TARGET_DATE}`);
  console.log(`  Max attempts per booking: ${CONFIG.MAX_ATTEMPTS_PER_BOOKING}`);
  console.log(`  Batch size: ${CONFIG.PARALLEL_BATCH_SIZE}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const supabase = getServiceSupabaseClient();

  // Step 1: Get restaurant
  console.log(`🔍 Looking up restaurant: ${CONFIG.TARGET_RESTAURANT_SLUG}...`);
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('slug', CONFIG.TARGET_RESTAURANT_SLUG)
    .single();

  if (restaurantError || !restaurant) {
    throw new Error(`Restaurant not found: ${CONFIG.TARGET_RESTAURANT_SLUG}`);
  }

  console.log(`✓ Found: ${restaurant.name} (${restaurant.id})\n`);

  // Step 2: Get all bookings for the date
  console.log(`📅 Fetching bookings for ${CONFIG.TARGET_DATE}...`);
  const allBookings = await getBookingsByDate(supabase, restaurant.id, CONFIG.TARGET_DATE);
  
  const pendingBookings = allBookings.filter(b => b.status === 'pending');
  const confirmedBookings = allBookings.filter(b => b.status === 'confirmed');
  const otherBookings = allBookings.filter(b => 
    b.status !== 'pending' && b.status !== 'confirmed'
  );

  console.log(`✓ Found ${allBookings.length} total bookings:`);
  console.log(`  - ${pendingBookings.length} PENDING (will process)`);
  console.log(`  - ${confirmedBookings.length} CONFIRMED (will skip)`);
  console.log(`  - ${otherBookings.length} OTHER statuses (will skip)\n`);

  if (pendingBookings.length === 0) {
    console.log('⚠️  No pending bookings to process. Exiting.\n');
    return;
  }

  // Step 3: Process bookings in parallel batches
  console.log(`⚡ Processing ${pendingBookings.length} pending bookings...`);
  console.log(`   Batch size: ${CONFIG.PARALLEL_BATCH_SIZE}\n`);

  const results: AssignmentResult[] = [];
  const totalBatches = Math.ceil(pendingBookings.length / CONFIG.PARALLEL_BATCH_SIZE);

  for (let i = 0; i < pendingBookings.length; i += CONFIG.PARALLEL_BATCH_SIZE) {
    const batchNum = Math.floor(i / CONFIG.PARALLEL_BATCH_SIZE) + 1;
    const batch = pendingBookings.slice(i, i + CONFIG.PARALLEL_BATCH_SIZE);
    
    console.log(`\n╔═══════════════════════════════════════════════════════════╗`);
    console.log(`║ BATCH ${batchNum}/${totalBatches} - Processing ${batch.length} bookings`);
    console.log(`╚═══════════════════════════════════════════════════════════╝`);

    const batchResults = await Promise.allSettled(
      batch.map(booking => processBooking(supabase, booking))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`❌ Batch processing error: ${result.reason}`);
      }
    }

    const successSoFar = results.filter(r => r.success).length;
    const failedSoFar = results.filter(r => !r.success).length;
    
    console.log(`\n📊 Running totals - Success: ${successSoFar}, Failed: ${failedSoFar}\n`);
  }

  // Step 4: Generate comprehensive report
  const totalExecutionTime = (Date.now() - scriptStartTime) / 1000;
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  const totalAttempts = results.reduce((sum, r) => sum + r.attempts.length, 0);
  const avgAttempts = results.length > 0 ? totalAttempts / results.length : 0;
  const avgProcessingTime = results.length > 0
    ? results.reduce((sum, r) => sum + r.totalProcessingTimeMs, 0) / results.length
    : 0;

  const report: ScriptReport = {
    metadata: {
      scriptVersion: 'comprehensive-from-scratch-v1.0',
      executionTimestamp: new Date().toISOString(),
      targetRestaurant: restaurant.name,
      targetDate: CONFIG.TARGET_DATE,
      configuration: CONFIG,
      totalExecutionTimeSeconds: Math.round(totalExecutionTime * 100) / 100,
    },
    summary: {
      totalBookingsFound: allBookings.length,
      pendingBookingsProcessed: results.length,
      successfulAssignments: successCount,
      failedAssignments: failureCount,
      successRate: results.length > 0 ? Math.round(successCount / results.length * 100) : 0,
      totalAttempts,
      averageAttemptsPerBooking: Math.round(avgAttempts * 100) / 100,
      averageProcessingTimeMs: Math.round(avgProcessingTime),
    },
    results,
  };

  // Save report
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const reportFilename = `auto-assign-comprehensive-${CONFIG.TARGET_DATE}-${timestamp}.json`;
  const reportPath = resolvePath(process.cwd(), 'reports', reportFilename);
  
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print final summary
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  FINAL SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  Restaurant: ${restaurant.name}`);
  console.log(`  Date: ${CONFIG.TARGET_DATE}`);
  console.log(`  Total bookings found: ${allBookings.length}`);
  console.log(`  Pending bookings processed: ${results.length}`);
  console.log(`  ✅ Successful assignments: ${successCount}`);
  console.log(`  ❌ Failed assignments: ${failureCount}`);
  console.log(`  Success rate: ${report.summary.successRate}%`);
  console.log(`  Total attempts: ${totalAttempts}`);
  console.log(`  Average attempts per booking: ${report.summary.averageAttemptsPerBooking}`);
  console.log(`  Average processing time: ${report.summary.averageProcessingTimeMs}ms`);
  console.log(`  Total execution time: ${totalExecutionTime.toFixed(2)}s`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  📁 Report saved: ${reportPath}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Print detailed results
  if (results.length > 0) {
    console.log('DETAILED RESULTS:\n');
    
    const successResults = results.filter(r => r.success);
    const failureResults = results.filter(r => !r.success);

    if (successResults.length > 0) {
      console.log(`✅ SUCCESSFUL ASSIGNMENTS (${successResults.length}):\n`);
      successResults.forEach(r => {
        console.log(`  ${r.bookingId.slice(0, 8)} | ${r.bookingTime} | party=${r.partySize}`);
        console.log(`    Tables: ${r.assignedTables?.map(t => t.tableNumber).join(', ')}`);
        console.log(`    Attempts: ${r.attempts.length}, Time: ${r.totalProcessingTimeMs}ms\n`);
      });
    }

    if (failureResults.length > 0) {
      console.log(`❌ FAILED ASSIGNMENTS (${failureResults.length}):\n`);
      failureResults.forEach(r => {
        console.log(`  ${r.bookingId.slice(0, 8)} | ${r.bookingTime} | party=${r.partySize}`);
        console.log(`    Reason: ${r.failureReason}`);
        console.log(`    Attempts: ${r.attempts.length}, Time: ${r.totalProcessingTimeMs}ms\n`);
      });
    }
  }

  console.log('✅ Script complete!\n');
}

// Run the script
main().catch(error => {
  console.error('\n❌ FATAL ERROR:', error);
  process.exit(1);
});
