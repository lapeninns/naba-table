/**
 * Ops Utility: Run auto-assign for a given date
 *
 * - Finds bookings on the specified date with status pending/pending_allocation
 * - Attempts to auto-assign tables (using capacity engine) and confirm
 * - Reports final status; for still-pending bookings, includes availability reason
 *
 * OPTIMIZED VERSION:
 * - Hardcoded for Prince of Wales Pub (Bromham) on 2025-11-09
 * - Parallel processing for faster execution
 *
 * Usage:
 *   pnpm tsx -r tsconfig-paths/register scripts/ops-auto-assign-date.ts
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';
// Load env in priority order (mirrors scripts/validate-env.ts)
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

// Ensure the job is enabled and emails are suppressed for ops run
if (!process.env.FEATURE_AUTO_ASSIGN_ON_BOOKING) {
  process.env.FEATURE_AUTO_ASSIGN_ON_BOOKING = 'true';
}
process.env.SUPPRESS_EMAILS = process.env.SUPPRESS_EMAILS ?? 'true';

import { DateTime } from 'luxon';
import fs from 'node:fs/promises';
import path from 'node:path';

// CONFIGURATION: Prince of Wales Pub (Bromham) for Nov 9, 2025
const TARGET_DATE = '2025-11-09';
const TARGET_RESTAURANT_SLUG = 'prince-of-wales-pub-bromham';
const PARALLEL_BATCH_SIZE = 5; // Process 5 bookings in parallel

// Note: import env-dependent modules dynamically (after dotenv loads)
// We'll declare variables and assign via dynamic import in main()
let getServiceSupabaseClient: typeof import('@/server/supabase').getServiceSupabaseClient;
let autoAssignAndConfirmIfPossible: typeof import('@/server/jobs/auto-assign').autoAssignAndConfirmIfPossible;
let checkSlotAvailability: typeof import('@/server/capacity').checkSlotAvailability;

import type { Tables } from '@/types/supabase';

function toTimeHHMM(startAt: string | null, startTime: string | null): string | null {
  // Prefer ISO startAt, fallback to start_time 'HH:MM' or 'HH:MM:SS'
  if (typeof startAt === 'string' && startAt) {
    const dt = DateTime.fromISO(startAt);
    if (dt.isValid) return dt.toFormat('HH:mm');
  }
  if (typeof startTime === 'string' && startTime) {
    const parts = startTime.split(':');
    if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return null;
}

type BookingRow = Pick<
  Tables<'bookings'>,
  | 'id'
  | 'restaurant_id'
  | 'status'
  | 'booking_date'
  | 'start_time'
  | 'start_at'
  | 'party_size'
  | 'seating_preference'
  | 'customer_name'
  | 'customer_email'
  | 'reference'
>;

type ReportItem = {
  id: string;
  restaurantId: string;
  bookingDate: string | null;
  time: string | null;
  partySize: number;
  status: string;
  reference: string | null;
  customerName: string | null;
  assignments: number;
  reason?: string | null;
  diagnostics?: {
    availabilityCheck?: any;
    assignmentError?: string;
    validationErrors?: string[];
    tableAvailability?: any;
    capacityInfo?: any;
  };
};

async function main() {
  console.log('[auto-assign] ========================================');
  console.log('[auto-assign] Starting OPTIMIZED auto-assign script');
  console.log('[auto-assign] ========================================');
  console.log(`[auto-assign] Target Restaurant: ${TARGET_RESTAURANT_SLUG}`);
  console.log(`[auto-assign] Target Date: ${TARGET_DATE}`);
  console.log(`[auto-assign] Parallel Batch Size: ${PARALLEL_BATCH_SIZE}`);
  console.log('[auto-assign] ========================================');

  // Resolve dynamic imports now that env is ready
  console.log('[auto-assign] Loading required modules...');
  ({ getServiceSupabaseClient } = await import('@/server/supabase'));
  console.log('[auto-assign] ✓ Loaded Supabase client');
  
  ({ autoAssignAndConfirmIfPossible } = await import('@/server/jobs/auto-assign'));
  console.log('[auto-assign] ✓ Loaded auto-assign module');
  
  ({ checkSlotAvailability } = await import('@/server/capacity'));
  console.log('[auto-assign] ✓ Loaded capacity module');

  const date = TARGET_DATE;

  console.log('[auto-assign] Initializing Supabase client...');
  const supabase = getServiceSupabaseClient();
  console.log('[auto-assign] ✓ Supabase client ready');

  // First, get the restaurant ID for Prince of Wales Pub (Bromham)
  console.log('[auto-assign] ----------------------------------------');
  console.log(`[auto-assign] Looking up restaurant: ${TARGET_RESTAURANT_SLUG}...`);
  const { data: restaurant, error: restError } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('slug', TARGET_RESTAURANT_SLUG)
    .single();
  
  if (restError || !restaurant) {
    throw new Error(`Failed to find restaurant '${TARGET_RESTAURANT_SLUG}': ${restError?.message ?? 'Not found'}`);
  }
  
  console.log(`[auto-assign] ✓ Found restaurant: ${restaurant.name} (${restaurant.id})`);
  const restaurantId = restaurant.id;

  // Fetch bookings in actionable statuses on the date
  console.log('[auto-assign] ----------------------------------------');
  console.log('[auto-assign] Querying bookings for date:', date);
  console.log('[auto-assign] Restaurant:', restaurant.name);
  
  const query = supabase
    .from('bookings')
    .select(
      'id, restaurant_id, status, booking_date, start_time, start_at, party_size, seating_preference, customer_name, customer_email, reference',
    )
    .eq('booking_date', date)
    .eq('restaurant_id', restaurantId)
    .in('status', ['pending', 'pending_allocation', 'confirmed', 'checked_in']);

  console.log('[auto-assign] Executing query...');
  const { data: bookings, error } = await query;
  if (error) throw new Error(`Failed to query bookings: ${error.message}`);

  const allForDate: BookingRow[] = (bookings ?? []) as BookingRow[];
  console.log(`[auto-assign] ✓ Found ${allForDate.length} total bookings for ${date}`);
  
  if (allForDate.length === 0) {
    console.log(`[auto-assign] No bookings found for ${date} at ${restaurant.name}.`);
    console.log('[auto-assign] ========================================');
    console.log('[auto-assign] Script complete - nothing to process');
    console.log('[auto-assign] ========================================');
    return;
  }
  
  // Log booking details
  console.log('[auto-assign] Booking breakdown by status:');
  const statusCounts = allForDate.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`[auto-assign]   - ${status}: ${count}`);
  });
  
  // Fetch existing non-shadow table allocations for those bookings
  const ids = allForDate.map((b) => b.id);
  console.log('[auto-assign] Checking existing allocations for', ids.length, 'bookings...');
  
  let allocatedSet = new Set<string>();
  try {
    console.log('[auto-assign] Querying allocations table...');
    const { data: allocs, error: allocErr } = await supabase
      .from('allocations')
      .select('id, booking_id, resource_type, shadow')
      .in('booking_id', ids)
      .eq('resource_type', 'table')
      .or('shadow.is.null,shadow.eq.false');
    if (allocErr) throw allocErr;
    allocatedSet = new Set((allocs ?? []).map((a) => String((a as { booking_id: string | null }).booking_id)).filter(Boolean));
    console.log(`[auto-assign] ✓ Found ${allocatedSet.size} bookings with allocations (via allocations table)`);
  } catch (e) {
    console.warn('[auto-assign] ⚠ allocations lookup failed, falling back to legacy booking_table_assignments');
    console.warn('[auto-assign] Error:', e instanceof Error ? e.message : String(e));
    const { data: legacy, error: legacyErr } = await supabase
      .from('booking_table_assignments')
      .select('booking_id')
      .in('booking_id', ids);
    if (!legacyErr) {
      allocatedSet = new Set((legacy ?? []).map((a) => String((a as { booking_id: string | null }).booking_id)).filter(Boolean));
      console.log(`[auto-assign] ✓ Found ${allocatedSet.size} bookings with allocations (via legacy table)`);
    }
  }
  
  const candidates: BookingRow[] = allForDate.filter((b) => !allocatedSet.has(b.id));
  console.log(`[auto-assign] ${candidates.length} bookings need table allocations`);
  
  if (candidates.length === 0) {
    console.log(`[auto-assign] All actionable bookings have table allocations for ${date}. Nothing to do.`);
    console.log('[auto-assign] ========================================');
    console.log('[auto-assign] Script complete - all bookings allocated');
    console.log('[auto-assign] ========================================');
    return;
  }

  console.log('[auto-assign] ----------------------------------------');
  console.log(`[auto-assign] Processing ${candidates.length} bookings in parallel batches of ${PARALLEL_BATCH_SIZE}...`);
  console.log('[auto-assign] ----------------------------------------');

  // Helper function to process a single booking
  const processBooking = async (row: BookingRow, index: number) => {
    const time = toTimeHHMM(row.start_at as string | null, row.start_time as string | null);
    console.log(`[auto-assign] [${index + 1}/${candidates.length}] Processing booking ${row.id}`);
    console.log(`[auto-assign]   - Date: ${row.booking_date}, Time: ${time ?? 'unknown'}`);
    console.log(`[auto-assign]   - Party size: ${row.party_size}, Status: ${row.status}`);
    console.log(`[auto-assign]   - Customer: ${row.customer_name ?? 'N/A'} (${row.customer_email ?? 'N/A'})`);
    console.log(`[auto-assign]   - Reference: ${row.reference ?? 'N/A'}`);
    
    const diagnostics: any = {};
    
    try {
      if (row.status === 'pending' || row.status === 'pending_allocation') {
        console.log(`[auto-assign]   → Calling autoAssignAndConfirmIfPossible...`);
        
        // First check availability to get detailed info
        if (row.booking_date && time) {
          try {
            const availCheck = await checkSlotAvailability({
              restaurantId: String(row.restaurant_id),
              date: String(row.booking_date),
              time,
              partySize: Number(row.party_size ?? 0),
              seatingPreference: (row.seating_preference as string | null) ?? undefined,
            });
            diagnostics.preAssignmentAvailability = availCheck;
            console.log(`[auto-assign]   → Pre-assignment availability: ${availCheck.available ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
            if (!availCheck.available) {
              console.log(`[auto-assign]   → Reason: ${availCheck.reason ?? 'Unknown'}`);
            }
          } catch (e) {
            diagnostics.availabilityCheckError = e instanceof Error ? e.message : String(e);
          }
        }
        
        await autoAssignAndConfirmIfPossible(row.id);
        console.log(`[auto-assign]   ✓ Auto-assign completed for ${row.id}`);
      } else {
        console.log(`[auto-assign]   → Booking is ${row.status}, using quote+confirm flow...`);
        const { quoteTablesForBooking, confirmHoldAssignment } = await import('@/server/capacity/tables');
        
        console.log(`[auto-assign]   → Requesting table quote...`);
        const quote = await quoteTablesForBooking({
          bookingId: row.id,
          holdTtlSeconds: 180,
          createdBy: 'ops-script',
        });
        
        diagnostics.quote = {
          hasHold: !!quote.hold,
          hasCandidate: !!quote.candidate,
          alternatesCount: quote.alternates?.length ?? 0,
          reason: quote.reason,
          nextTimes: quote.nextTimes,
        };
        
        if (quote.hold) {
          console.log(`[auto-assign]   → Got hold ${quote.hold.id}, confirming assignment...`);
          await confirmHoldAssignment({
            holdId: quote.hold.id,
            bookingId: row.id,
            idempotencyKey: `ops-${row.id}`,
            assignedBy: null,
          });
          console.log(`[auto-assign]   ✓ Assignment confirmed for ${row.id}`);
        } else {
          console.log(`[auto-assign]   ⚠ No hold returned in quote for ${row.id}`);
          console.log(`[auto-assign]   → Quote reason: ${quote.reason ?? 'Not provided'}`);
        }
      }
      return { success: true, bookingId: row.id, diagnostics };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      const errorStack = e instanceof Error ? e.stack : undefined;
      
      diagnostics.assignmentError = errorMsg;
      diagnostics.errorStack = errorStack;
      
      console.error(`[auto-assign]   ✗ Failed to assign booking ${row.id}:`, errorMsg);
      if (errorStack) {
        console.error(`[auto-assign]   Stack trace:`, errorStack);
      }
      
      return { success: false, bookingId: row.id, error: e, diagnostics };
    }
  };

  // Process bookings in parallel batches
  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  const bookingDiagnostics = new Map<string, any>(); // Store diagnostics per booking
  
  for (let i = 0; i < candidates.length; i += PARALLEL_BATCH_SIZE) {
    const batch = candidates.slice(i, i + PARALLEL_BATCH_SIZE);
    const batchNum = Math.floor(i / PARALLEL_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(candidates.length / PARALLEL_BATCH_SIZE);
    
    console.log(`\n[auto-assign] === Batch ${batchNum}/${totalBatches} (${batch.length} bookings) ===`);
    
    const results = await Promise.allSettled(
      batch.map((row, batchIndex) => processBooking(row, i + batchIndex))
    );
    
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        const bookingId = batch[idx].id;
        bookingDiagnostics.set(bookingId, result.value.diagnostics);
        
        if (result.value.success) {
          successCount++;
        } else {
          failCount++;
        }
      } else {
        failCount++;
      }
    });
    
    console.log(`[auto-assign] Batch ${batchNum} complete. Success: ${successCount}, Failed: ${failCount}`);
    console.log(''); // Blank line between batches
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('[auto-assign] ----------------------------------------');
  console.log(`[auto-assign] All batches complete in ${elapsed}s`);
  console.log(`[auto-assign] Success: ${successCount}, Failed: ${failCount}`);
  console.log('[auto-assign] ----------------------------------------');
  
  // Reload statuses and assignment counts
  const ids2 = candidates.map((b) => b.id);
  console.log('[auto-assign] Querying refreshed booking data...');
  const { data: refreshed, error: refreshErr } = await supabase
    .from('bookings')
    .select('id, restaurant_id, status, booking_date, start_time, start_at, party_size, seating_preference, customer_name, customer_email, reference')
    .in('id', ids2);
  if (refreshErr) throw new Error(`Refresh failed: ${refreshErr.message}`);
  console.log(`[auto-assign] ✓ Refreshed ${refreshed?.length ?? 0} booking records`);

  // Recompute allocation counts via allocations table (non-shadow, tables only)
  console.log('[auto-assign] Recomputing allocation counts...');
  const assignCount = new Map<string, number>();
  try {
    console.log('[auto-assign] Querying allocations table for assignment counts...');
    const { data: assignments2, error: assignErr2 } = await supabase
      .from('allocations')
      .select('id, booking_id')
      .in('booking_id', ids2)
      .eq('resource_type', 'table')
      .or('shadow.is.null,shadow.eq.false');
    if (assignErr2) throw assignErr2;
    for (const a of assignments2 ?? []) {
      const b = (a as { booking_id: string | null }).booking_id;
      if (!b) continue;
      assignCount.set(b, (assignCount.get(b) ?? 0) + 1);
    }
    console.log(`[auto-assign] ✓ Counted allocations for ${assignCount.size} bookings (via allocations table)`);
  } catch {
    console.log('[auto-assign] ⚠ Falling back to legacy booking_table_assignments for counts...');
    // Fallback to legacy
    const { data: legacy2 } = await supabase
      .from('booking_table_assignments')
      .select('id, booking_id')
      .in('booking_id', ids2);
    for (const a of legacy2 ?? []) {
      const b = (a as { booking_id: string | null }).booking_id;
      if (!b) continue;
      assignCount.set(b, (assignCount.get(b) ?? 0) + 1);
    }
    console.log(`[auto-assign] ✓ Counted allocations for ${assignCount.size} bookings (via legacy table)`);
  }

  // Build report
  console.log('[auto-assign] Building final report...');
  const pending: BookingRow[] = [];
  const report: ReportItem[] = (refreshed ?? []).map((row) => {
    const time = toTimeHHMM(row.start_at as string | null, row.start_time as string | null);
    const item: ReportItem = {
      id: String(row.id),
      restaurantId: String(row.restaurant_id),
      bookingDate: (row.booking_date as string | null) ?? null,
      time,
      partySize: Number(row.party_size ?? 0),
      status: String(row.status),
      reference: (row.reference as string | null) ?? null,
      customerName: (row.customer_name as string | null) ?? null,
      assignments: assignCount.get(String(row.id)) ?? 0,
    };
    if (row.status === 'pending' || row.status === 'pending_allocation') {
      pending.push(row as BookingRow);
    }
    return item;
  });

  // For still-pending bookings, compute availability reason
  console.log(`[auto-assign] Analyzing ${pending.length} still-pending bookings...`);
  let pendingProcessed = 0;
  
  for (const row of pending) {
    pendingProcessed++;
    console.log(`[auto-assign] [${pendingProcessed}/${pending.length}] Comprehensive diagnosis for pending booking ${row.id}...`);
    const time = toTimeHHMM(row.start_at as string | null, row.start_time as string | null);
    let reason: string | null = null;
    const fullDiagnostics: any = {
      bookingId: row.id,
      partySize: row.party_size,
      date: row.booking_date,
      time,
      seatingPreference: row.seating_preference,
    };
    
    try {
      if (row.booking_date && time) {
        // 1. Check slot availability
        console.log(`[auto-assign]   → Running availability check...`);
        const avail = await checkSlotAvailability({
          restaurantId: String(row.restaurant_id),
          date: String(row.booking_date),
          time,
          partySize: Number(row.party_size ?? 0),
          seatingPreference: (row.seating_preference as string | null) ?? undefined,
        });
        
        fullDiagnostics.availabilityCheck = {
          available: avail.available,
          reason: avail.reason,
        };
        
        reason = avail.reason ?? null;
        console.log(`[auto-assign]   → Available: ${avail.available}`);
        console.log(`[auto-assign]   → Reason: ${reason ?? 'N/A'}`);
        
        // 2. Try to get a quote to see what the system would suggest
        try {
          console.log(`[auto-assign]   → Attempting to get table quote...`);
          const { quoteTablesForBooking } = await import('@/server/capacity/tables');
          const quote = await quoteTablesForBooking({
            bookingId: row.id,
            holdTtlSeconds: 0, // No hold, just diagnostic
            createdBy: 'ops-diagnostic',
          });
          
          fullDiagnostics.quoteAttempt = {
            gotHold: !!quote.hold,
            gotCandidate: !!quote.candidate,
            candidateDetails: quote.candidate ? {
              tableIds: quote.candidate.tableIds,
              totalCapacity: quote.candidate.totalCapacity,
              score: quote.candidate.score,
            } : null,
            alternatesCount: quote.alternates?.length ?? 0,
            alternateOptions: quote.alternates?.slice(0, 3).map(alt => ({
              tableIds: alt.tableIds,
              totalCapacity: alt.totalCapacity,
              score: alt.score,
            })),
            reason: quote.reason,
            skippedCandidates: quote.skipped?.map(s => ({
              tableIds: s.candidate.tableIds,
              reason: s.reason,
              conflictCount: s.conflicts?.length ?? 0,
            })),
          };
          
          console.log(`[auto-assign]   → Quote result: ${quote.hold ? 'GOT HOLD' : 'NO HOLD'}`);
          if (quote.reason) {
            console.log(`[auto-assign]   → Quote reason: ${quote.reason}`);
          }
          if (quote.skipped && quote.skipped.length > 0) {
            console.log(`[auto-assign]   → Skipped ${quote.skipped.length} candidates:`);
            quote.skipped.forEach((skip, idx) => {
              console.log(`[auto-assign]     [${idx + 1}] Tables ${skip.candidate.tableIds.join('+')}: ${skip.reason}`);
              if (skip.conflicts && skip.conflicts.length > 0) {
                console.log(`[auto-assign]         Conflicts: ${skip.conflicts.length}`);
              }
            });
          }
        } catch (quoteErr) {
          fullDiagnostics.quoteError = quoteErr instanceof Error ? quoteErr.message : String(quoteErr);
          console.error(`[auto-assign]   ✗ Quote attempt failed: ${fullDiagnostics.quoteError}`);
        }
        
        // 3. Check for existing allocations or holds that might block
        try {
          console.log(`[auto-assign]   → Checking for blocking allocations/holds...`);
          const { data: existingAllocs } = await supabase
            .from('allocations')
            .select('id, resource_id, resource_type, shadow')
            .eq('booking_id', row.id);
          
          fullDiagnostics.existingAllocations = existingAllocs?.map(a => ({
            id: a.id,
            resourceId: a.resource_id,
            resourceType: a.resource_type,
            shadow: a.shadow,
          }));
          
          if (existingAllocs && existingAllocs.length > 0) {
            console.log(`[auto-assign]   → Found ${existingAllocs.length} existing allocations`);
          }
        } catch (allocErr) {
          fullDiagnostics.allocationCheckError = allocErr instanceof Error ? allocErr.message : String(allocErr);
        }
        
        // 4. Get restaurant capacity info for this time
        try {
          const { data: restaurant } = await supabase
            .from('restaurants')
            .select('name, timezone')
            .eq('id', row.restaurant_id)
            .single();
          
          const { data: tables } = await supabase
            .from('table_inventory')
            .select('id, table_number, capacity, category, seating_type')
            .eq('restaurant_id', row.restaurant_id)
            .eq('active', true);
          
          fullDiagnostics.restaurantCapacity = {
            restaurantName: restaurant?.name,
            totalTables: tables?.length ?? 0,
            totalSeats: tables?.reduce((sum: number, t: any) => sum + (t.capacity ?? 0), 0) ?? 0,
            tablesByCapacity: tables?.reduce((acc: Record<number, number>, t: any) => {
              const cap = t.capacity ?? 0;
              acc[cap] = (acc[cap] || 0) + 1;
              return acc;
            }, {} as Record<number, number>),
          };
          
          console.log(`[auto-assign]   → Restaurant: ${fullDiagnostics.restaurantCapacity.totalTables} tables, ${fullDiagnostics.restaurantCapacity.totalSeats} seats`);
        } catch (capErr) {
          fullDiagnostics.capacityCheckError = capErr instanceof Error ? capErr.message : String(capErr);
        }
        
      } else {
        console.log(`[auto-assign]   ⚠ Missing date or time, skipping availability check`);
        fullDiagnostics.error = 'Missing date or time';
      }
    } catch (e) {
      reason = e instanceof Error ? e.message : String(e);
      fullDiagnostics.generalError = reason;
      console.error(`[auto-assign]   ✗ Diagnostic check failed: ${reason}`);
    }
    
    const entry = report.find((r) => r.id === row.id);
    if (entry) {
      entry.reason = reason;
      entry.diagnostics = fullDiagnostics;
    }
    
    console.log(''); // Blank line for readability
  }
  
  // Validate successful assignments
  console.log('[auto-assign] ========================================');
  console.log('[auto-assign] VALIDATING SUCCESSFUL ASSIGNMENTS');
  console.log('[auto-assign] ========================================');
  
  const successfulBookings = report.filter(r => 
    (r.status === 'confirmed' || r.status === 'checked_in') && r.assignments > 0
  );
  
  console.log(`[auto-assign] Validating ${successfulBookings.length} successful assignments...`);
  
  let validCount = 0;
  let invalidCount = 0;
  const validationIssues: Array<{bookingId: string; issues: string[]}> = [];
  
  for (const booking of successfulBookings) {
    const issues: string[] = [];
    
    // Check 1: Has allocations
    if (booking.assignments === 0) {
      issues.push('No table allocations found');
    }
    
    // Check 2: Get allocation details
    try {
      const { data: allocs } = await supabase
        .from('allocations')
        .select('id, resource_id, resource_type, shadow')
        .eq('booking_id', booking.id)
        .eq('resource_type', 'table')
        .or('shadow.is.null,shadow.eq.false');
      
      if (!allocs || allocs.length === 0) {
        issues.push('Allocations query returned empty');
      } else {
        // Check 3: Verify table capacity
        const tableIds = allocs.map(a => a.resource_id).filter(Boolean);
        if (tableIds.length > 0) {
          const { data: tables } = await supabase
            .from('table_inventory')
            .select('id, capacity, active')
            .in('id', tableIds);
          
          const totalCapacity = tables?.reduce((sum: number, t: any) => sum + (t.capacity ?? 0), 0) ?? 0;
          const inactiveTables = tables?.filter((t: any) => !t.active) ?? [];
          
          if (totalCapacity < booking.partySize) {
            issues.push(`Insufficient capacity: ${totalCapacity} < ${booking.partySize}`);
          }
          
          if (inactiveTables.length > 0) {
            issues.push(`Assigned ${inactiveTables.length} inactive table(s)`);
          }
        }
      }
    } catch (validationErr) {
      issues.push(`Validation error: ${validationErr instanceof Error ? validationErr.message : String(validationErr)}`);
    }
    
    if (issues.length > 0) {
      invalidCount++;
      validationIssues.push({ bookingId: booking.id, issues });
      console.log(`[auto-assign] ✗ Booking ${booking.id}: ${issues.join(', ')}`);
    } else {
      validCount++;
    }
  }
  
  console.log(`[auto-assign] ✓ Valid: ${validCount}, ✗ Invalid: ${invalidCount}`);

  // Persist report
  console.log('[auto-assign] ----------------------------------------');
  console.log('[auto-assign] Persisting report...');
  const outDir = path.resolve('reports');
  await fs.mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `auto-assign-${date}-${stamp}.json`);
  await fs.writeFile(outPath, JSON.stringify({ date, restaurantId, report }, null, 2));
  console.log(`[auto-assign] ✓ Report written: ${outPath}`);

  // Console summary
  console.log('[auto-assign] ========================================');
  console.log('[auto-assign] FINAL SUMMARY');
  console.log('[auto-assign] ========================================');
  console.log(`[auto-assign] Date: ${date}`);
  console.log(`[auto-assign] Total bookings processed: ${report.length}`);
  
  const finalStatusCounts = report.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('[auto-assign] Status breakdown:');
  Object.entries(finalStatusCounts).forEach(([status, count]) => {
    console.log(`[auto-assign]   - ${status}: ${count}`);
  });
  
  const successfulAssignments = report.filter(r => r.assignments > 0).length;
  const failedAssignments = report.filter(r => r.assignments === 0 && (r.status === 'pending' || r.status === 'pending_allocation')).length;
  
  console.log(`[auto-assign] Successful assignments: ${successfulAssignments}`);
  console.log(`[auto-assign] Failed assignments: ${failedAssignments}`);
  console.log('[auto-assign] ----------------------------------------');
  
  const lines = report.map((r) => {
    const base = `${r.id} | ${r.time ?? '--:--'} | party=${r.partySize} | status=${r.status} | tables=${r.assignments}`;
    return r.status.startsWith('pending') ? `${base} | reason=${r.reason ?? 'UNKNOWN'}` : base;
  });
  console.log('\nDetailed Results:\n' + lines.join('\n'));
  
  console.log('\n[auto-assign] ========================================');
  console.log('[auto-assign] Script complete!');
  console.log('[auto-assign] ========================================');
}

main().catch((err) => {
  console.error('[auto-assign] ========================================');
  console.error('[auto-assign] FATAL ERROR');
  console.error('[auto-assign] ========================================');
  console.error('[auto-assign] Error:', err);
  if (err instanceof Error && err.stack) {
    console.error('[auto-assign] Stack trace:', err.stack);
  }
  console.error('[auto-assign] ========================================');
  process.exit(1);
});
