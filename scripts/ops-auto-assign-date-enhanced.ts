/**
 * Ops Utility: Run auto-assign for a given date - ENHANCED VERSION
 *
 * - Finds ONLY PENDING bookings on the specified date
 * - Attempts to auto-assign tables (using capacity engine) and confirm
 * - Comprehensive reporting including table assignments, validation details
 *
 * FEATURES:
 * - Only processes PENDING status bookings
 * - Detailed table assignment tracking
 * - Validation checks for successful assignments
 * - Comprehensive failure diagnostics
 * - Parallel processing for speed
 *
 * Usage:
 *   pnpm tsx -r tsconfig-paths/register scripts/ops-auto-assign-date-enhanced.ts
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';
// Load env in priority order
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

// Dynamic imports
let getServiceSupabaseClient: typeof import('@/server/supabase').getServiceSupabaseClient;
let autoAssignAndConfirmIfPossible: typeof import('@/server/jobs/auto-assign').autoAssignAndConfirmIfPossible;
let checkSlotAvailability: typeof import('@/server/capacity').checkSlotAvailability;
let quoteTablesForBooking: typeof import('@/server/capacity/tables').quoteTablesForBooking;
let confirmHoldAssignment: typeof import('@/server/capacity/tables').confirmHoldAssignment;

import type { Tables } from '@/types/supabase';

function toTimeHHMM(startAt: string | null, startTime: string | null): string | null {
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

type TableAssignment = {
  tableId: string;
  tableNumber: string;
  capacity: number;
  category: string;
  seatingType: string;
  zoneName?: string;
};

type ValidationCheck = {
  check: string;
  passed: boolean;
  details?: string;
};

type ReportItem = {
  id: string;
  restaurantId: string;
  bookingDate: string | null;
  time: string | null;
  partySize: number;
  status: string;
  reference: string | null;
  customerName: string | null;
  customerEmail: string | null;
  seatingPreference: string | null;
  
  // Assignment details
  assignmentSuccess: boolean;
  assignedTables?: TableAssignment[];
  totalTableCapacity?: number;
  
  // Validation results
  validationChecks?: ValidationCheck[];
  allValidationsPassed?: boolean;
  
  // Diagnostics (for failures)
  failureReason?: string;
  diagnostics?: {
    availabilityCheck?: any;
    quoteAttempt?: any;
    assignmentError?: string;
    existingAllocations?: any[];
    restaurantCapacity?: any;
  };
};

async function main() {
  console.log('[auto-assign] ========================================');
  console.log('[auto-assign] ENHANCED Auto-Assign Script');
  console.log('[auto-assign] ========================================');
  console.log(`[auto-assign] Target Restaurant: ${TARGET_RESTAURANT_SLUG}`);
  console.log(`[auto-assign] Target Date: ${TARGET_DATE}`);
  console.log(`[auto-assign] Processing: PENDING bookings ONLY`);
  console.log(`[auto-assign] Parallel Batch Size: ${PARALLEL_BATCH_SIZE}`);
  console.log('[auto-assign] ========================================');

  // Load modules
  console.log('[auto-assign] Loading required modules...');
  ({ getServiceSupabaseClient } = await import('@/server/supabase'));
  ({ autoAssignAndConfirmIfPossible } = await import('@/server/jobs/auto-assign'));
  ({ checkSlotAvailability } = await import('@/server/capacity'));
  ({ quoteTablesForBooking, confirmHoldAssignment } = await import('@/server/capacity/tables'));
  console.log('[auto-assign] ✓ All modules loaded');

  const supabase = getServiceSupabaseClient();

  // Get restaurant
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
  
  console.log(`[auto-assign] ✓ Found: ${restaurant.name} (${restaurant.id})`);
  const restaurantId = restaurant.id;

  // Fetch ALL bookings for the date (to show stats)
  console.log('[auto-assign] ----------------------------------------');
  console.log('[auto-assign] Querying all bookings for date:', TARGET_DATE);
  
  const { data: allBookings, error } = await supabase
    .from('bookings')
    .select('id, restaurant_id, status, booking_date, start_time, start_at, party_size, seating_preference, customer_name, customer_email, reference')
    .eq('booking_date', TARGET_DATE)
    .eq('restaurant_id', restaurantId);

  if (error) throw new Error(`Failed to query bookings: ${error.message}`);

  const allForDate: BookingRow[] = (allBookings ?? []) as BookingRow[];
  console.log(`[auto-assign] ✓ Found ${allForDate.length} total bookings`);
  
  // Show status breakdown
  console.log('[auto-assign] Status breakdown:');
  const statusCounts = allForDate.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`[auto-assign]   - ${status}: ${count}`);
  });
  
  // *** FILTER TO ONLY PENDING BOOKINGS ***
  const pendingBookings = allForDate.filter(b => b.status === 'pending');
  console.log('[auto-assign] ========================================');
  console.log(`[auto-assign] FILTERED to ${pendingBookings.length} PENDING bookings`);
  console.log(`[auto-assign] SKIPPING ${allForDate.length - pendingBookings.length} non-pending bookings`);
  console.log('[auto-assign] ========================================');
  
  if (pendingBookings.length === 0) {
    console.log('[auto-assign] No pending bookings to process. Exiting.');
    return;
  }

  // Process bookings
  console.log(`[auto-assign] Processing ${pendingBookings.length} pending bookings...`);
  console.log('[auto-assign] ----------------------------------------');

  const results: ReportItem[] = [];
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  // Helper to get table details after assignment
  const getAssignedTableDetails = async (bookingId: string): Promise<TableAssignment[]> => {
    const { data: allocs } = await supabase
      .from('allocations')
      .select(`
        id,
        table_id,
        table_inventory!inner(
          id,
          table_number,
          capacity,
          category,
          seating_type,
          zones(name)
        )
      `)
      .eq('booking_id', bookingId)
      .eq('resource_type', 'table')
      .or('shadow.is.null,shadow.eq.false');

    if (!allocs) return [];

    return allocs.map((a: any) => ({
      tableId: a.table_id,
      tableNumber: a.table_inventory.table_number,
      capacity: a.table_inventory.capacity,
      category: a.table_inventory.category,
      seatingType: a.table_inventory.seating_type,
      zoneName: a.table_inventory.zones?.name,
    }));
  };

  // Helper to validate an assignment
  const validateAssignment = async (bookingId: string, partySize: number, tables: TableAssignment[]): Promise<ValidationCheck[]> => {
    const checks: ValidationCheck[] = [];

    // Check 1: Has at least one table
    checks.push({
      check: 'Has table assignment',
      passed: tables.length > 0,
      details: `${tables.length} table(s) assigned`,
    });

    // Check 2: Total capacity >= party size
    const totalCap = tables.reduce((sum, t) => sum + t.capacity, 0);
    checks.push({
      check: 'Sufficient capacity',
      passed: totalCap >= partySize,
      details: `Total capacity: ${totalCap}, Party size: ${partySize}`,
    });

    // Check 3: All tables are active
    const tableIds = tables.map(t => t.tableId);
    if (tableIds.length > 0) {
      const { data: tableData } = await supabase
        .from('table_inventory')
        .select('id, active')
        .in('id', tableIds);

      const inactiveTables = tableData?.filter((t: any) => !t.active) ?? [];
      checks.push({
        check: 'All tables active',
        passed: inactiveTables.length === 0,
        details: inactiveTables.length > 0 ? `${inactiveTables.length} inactive tables` : 'All tables active',
      });
    }

    // Check 4: Allocation records exist
    const { data: allocations } = await supabase
      .from('allocations')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('resource_type', 'table');

    checks.push({
      check: 'Allocation records exist',
      passed: (allocations?.length ?? 0) > 0,
      details: `${allocations?.length ?? 0} allocation record(s)`,
    });

    return checks;
  };

  // Process each booking
  for (let i = 0; i < pendingBookings.length; i += PARALLEL_BATCH_SIZE) {
    const batch = pendingBookings.slice(i, i + PARALLEL_BATCH_SIZE);
    const batchNum = Math.floor(i / PARALLEL_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(pendingBookings.length / PARALLEL_BATCH_SIZE);
    
    console.log(`\n[auto-assign] === Batch ${batchNum}/${totalBatches} (${batch.length} bookings) ===\n`);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (row, batchIdx) => {
        const globalIdx = i + batchIdx + 1;
        const time = toTimeHHMM(row.start_at as string | null, row.start_time as string | null);
        
        console.log(`[auto-assign] [${globalIdx}/${pendingBookings.length}] Processing: ${row.id}`);
        console.log(`[auto-assign]   Customer: ${row.customer_name ?? 'N/A'}`);
        console.log(`[auto-assign]   Time: ${time ?? 'unknown'}, Party: ${row.party_size}, Ref: ${row.reference ?? 'N/A'}`);
        
        const item: ReportItem = {
          id: String(row.id),
          restaurantId: String(row.restaurant_id),
          bookingDate: (row.booking_date as string | null) ?? null,
          time,
          partySize: Number(row.party_size ?? 0),
          status: 'pending', // Initial status
          reference: (row.reference as string | null) ?? null,
          customerName: (row.customer_name as string | null) ?? null,
          customerEmail: (row.customer_email as string | null) ?? null,
          seatingPreference: (row.seating_preference as string | null) ?? null,
          assignmentSuccess: false,
        };
        
        try {
          // Attempt assignment
          console.log(`[auto-assign]   → Attempting auto-assignment...`);
          await autoAssignAndConfirmIfPossible(row.id);
          
          // Check if booking was updated
          const { data: updated } = await supabase
            .from('bookings')
            .select('status')
            .eq('id', row.id)
            .single();
          
          item.status = updated?.status ?? 'pending';
          
          if (updated?.status === 'confirmed' || updated?.status === 'checked_in') {
            // SUCCESS - get assignment details
            console.log(`[auto-assign]   ✓ Assignment successful! Status: ${updated.status}`);
            
            const tables = await getAssignedTableDetails(row.id);
            const validations = await validateAssignment(row.id, row.party_size ?? 0, tables);
            
            item.assignmentSuccess = true;
            item.assignedTables = tables;
            item.totalTableCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
            item.validationChecks = validations;
            item.allValidationsPassed = validations.every(v => v.passed);
            
            console.log(`[auto-assign]   → Assigned ${tables.length} table(s):`);
            tables.forEach(t => {
              console.log(`[auto-assign]     - Table ${t.tableNumber} (${t.category}, cap: ${t.capacity}, ${t.seatingType}${t.zoneName ? `, zone: ${t.zoneName}` : ''})`);
            });
            console.log(`[auto-assign]   → Total capacity: ${item.totalTableCapacity}`);
            console.log(`[auto-assign]   → All validations passed: ${item.allValidationsPassed ? 'YES ✓' : 'NO ✗'}`);
            
            successCount++;
          } else {
            // Still pending - gather diagnostics
            console.log(`[auto-assign]   ⚠ Still pending after assignment attempt`);
            await gatherFailureDiagnostics(row, item);
            failCount++;
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          console.error(`[auto-assign]   ✗ Assignment failed: ${errorMsg}`);
          
          item.assignmentSuccess = false;
          item.failureReason = errorMsg;
          item.diagnostics = { assignmentError: errorMsg };
          
          await gatherFailureDiagnostics(row, item);
          failCount++;
        }
        
        return item;
      })
    );
    
    // Collect results
    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    });
    
    console.log(`\n[auto-assign] Batch ${batchNum} complete. Running total - Success: ${successCount}, Failed: ${failCount}\n`);
  }

  // Helper function to gather failure diagnostics
  async function gatherFailureDiagnostics(row: BookingRow, item: ReportItem) {
    const time = toTimeHHMM(row.start_at as string | null, row.start_time as string | null);
    
    if (!item.diagnostics) item.diagnostics = {};
    
    console.log(`[auto-assign]   → Gathering comprehensive diagnostics...`);
    
    // 1. Availability check
    if (row.booking_date && time) {
      try {
        const avail = await checkSlotAvailability({
          restaurantId: String(row.restaurant_id),
          date: String(row.booking_date),
          time,
          partySize: Number(row.party_size ?? 0),
          seatingPreference: (row.seating_preference as string | null) ?? undefined,
        });
        
        item.diagnostics.availabilityCheck = {
          available: avail.available,
          reason: avail.reason,
        };
        
        console.log(`[auto-assign]     - Availability: ${avail.available ? 'YES' : 'NO'}`);
        if (!avail.available) {
          console.log(`[auto-assign]     - Reason: ${avail.reason ?? 'Unknown'}`);
          item.failureReason = avail.reason ?? 'Availability check failed';
        }
      } catch (e) {
        console.log(`[auto-assign]     - Availability check error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    
    // 2. Quote attempt
    try {
      console.log(`[auto-assign]     - Attempting table quote...`);
      const quote = await quoteTablesForBooking({
        bookingId: row.id,
        holdTtlSeconds: 180,
        createdBy: 'ops-diagnostic',
      });
      
      const quoteInfo: any = {
        gotHold: !!quote.hold,
        gotCandidate: !!quote.candidate,
        candidateDetails: quote.candidate ? {
          tableIds: quote.candidate.tableIds,
          totalCapacity: quote.candidate.tableIds?.length ?? 0,
          score: (quote.candidate as any).score,
        } : null,
        alternatesCount: quote.alternates?.length ?? 0,
        alternateOptions: quote.alternates?.slice(0, 3).map(alt => ({
          tableIds: alt.tableIds,
          totalCapacity: (alt as any).totalCapacity ?? alt.tableIds?.length ?? 0,
          score: (alt as any).score,
        })),
        reason: quote.reason,
        skippedCandidates: quote.skipped?.map(skip => ({
          tableIds: (skip as any).tableIds ?? (skip.candidate as any)?.tableIds,
          reason: skip.reason,
          conflictCount: (skip as any).conflicts?.length ?? 0,
        })),
      };
      
      item.diagnostics.quoteAttempt = quoteInfo;
      
      console.log(`[auto-assign]     - Got hold: ${quoteInfo.gotHold ? 'YES' : 'NO'}`);
      console.log(`[auto-assign]     - Got candidate: ${quoteInfo.gotCandidate ? 'YES' : 'NO'}`);
      console.log(`[auto-assign]     - Alternates: ${quoteInfo.alternatesCount}`);
      console.log(`[auto-assign]     - Skipped: ${quoteInfo.skippedCandidates?.length ?? 0}`);
      console.log(`[auto-assign]     - Reason: ${quoteInfo.reason ?? 'N/A'}`);
      
      if (!item.failureReason && quote.reason) {
        item.failureReason = quote.reason;
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.log(`[auto-assign]     - Quote error: ${errMsg}`);
      if (!item.failureReason) {
        item.failureReason = errMsg;
      }
      if (item.diagnostics) {
        (item.diagnostics as any).quoteError = errMsg;
      }
    }
    
    // 3. Check existing allocations
    const { data: existingAllocs } = await supabase
      .from('allocations')
      .select('id, table_id, created_at, shadow')
      .eq('booking_id', row.id);
    
    if (existingAllocs && existingAllocs.length > 0) {
      item.diagnostics.existingAllocations = existingAllocs;
      console.log(`[auto-assign]     - Existing allocations: ${existingAllocs.length}`);
    }
    
    // 4. Restaurant capacity info
    const { data: capacityInfo } = await supabase
      .from('table_inventory')
      .select('capacity, category, seating_type')
      .eq('restaurant_id', row.restaurant_id)
      .eq('active', true);
    
    if (capacityInfo) {
      const byCapacity = capacityInfo.reduce((acc: Record<number, number>, t: any) => {
        acc[t.capacity] = (acc[t.capacity] || 0) + 1;
        return acc;
      }, {});
      
      item.diagnostics.restaurantCapacity = {
        restaurantName: restaurant?.name ?? 'Unknown',
        totalTables: capacityInfo.length,
        totalSeats: capacityInfo.reduce((sum: number, t: any) => sum + t.capacity, 0),
        tablesByCapacity: byCapacity,
      };
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // Save report
  console.log('[auto-assign] ========================================');
  console.log('[auto-assign] Saving comprehensive report...');
  const reportFileName = `auto-assign-enhanced-${TARGET_DATE}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const reportPath = path.join(process.cwd(), 'reports', reportFileName);
  
  const fullReport = {
    date: TARGET_DATE,
    restaurant: restaurant.name,
    restaurantId,
    processedAt: new Date().toISOString(),
    totalPendingBookings: pendingBookings.length,
    successCount,
    failCount,
    elapsedSeconds: parseFloat(elapsed),
    bookings: results,
  };
  
  await fs.writeFile(reportPath, JSON.stringify(fullReport, null, 2));
  console.log(`[auto-assign] ✓ Report saved: ${reportPath}`);

  // Print summary
  console.log('[auto-assign] ========================================');
  console.log('[auto-assign] FINAL SUMMARY');
  console.log('[auto-assign] ========================================');
  console.log(`[auto-assign] Date: ${TARGET_DATE}`);
  console.log(`[auto-assign] Restaurant: ${restaurant.name}`);
  console.log(`[auto-assign] Pending bookings processed: ${pendingBookings.length}`);
  console.log(`[auto-assign] ✓ Successful assignments: ${successCount}`);
  console.log(`[auto-assign] ✗ Failed assignments: ${failCount}`);
  console.log(`[auto-assign] Time elapsed: ${elapsed}s`);
  console.log('[auto-assign] ========================================');
  
  // Detailed results
  console.log('\nDetailed Results:\n');
  results.forEach(r => {
    const statusIcon = r.assignmentSuccess ? '✓' : '✗';
    console.log(`${statusIcon} ${r.id} | ${r.time} | party=${r.partySize} | ${r.assignmentSuccess ? `tables=${r.assignedTables?.length}, capacity=${r.totalTableCapacity}` : `reason=${r.failureReason ?? 'Unknown'}`}`);
  });

  console.log('\n[auto-assign] ========================================');
  console.log('[auto-assign] Script complete!');
  console.log('[auto-assign] ========================================');
}

main().catch((err) => {
  console.error('[auto-assign] Fatal error:', err);
  process.exit(1);
});
