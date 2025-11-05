#!/usr/bin/env tsx
/**
 * Production Monitoring Script for Table Combinations
 * 
 * Monitors:
 * - Combination usage percentage
 * - Orphaned bookings (confirmed with 0 assignments)
 * - Zone lock conflicts
 * - Assignment success rates
 * - Performance metrics
 * 
 * Usage:
 *   pnpm tsx -r tsconfig-paths/register scripts/production-monitor.ts
 *   pnpm tsx -r tsconfig-paths/register scripts/production-monitor.ts --restaurant-id=<id>
 *   pnpm tsx -r tsconfig-paths/register scripts/production-monitor.ts --days=7
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

// Load env BEFORE any imports
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

interface MonitorConfig {
  restaurantId?: string;
  days: number;
}

interface MetricsSummary {
  period: {
    start: string;
    end: string;
    days: number;
  };
  bookings: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
  };
  assignments: {
    totalAssignments: number;
    singleTable: number;
    multiTable: number;
    combinationUsagePercent: number;
  };
  dataIntegrity: {
    orphanedBookings: number;
    zoneLockedBookings: number;
    bookingsWithoutZone: number;
  };
  performance: {
    avgTablesPerBooking: number;
    maxTablesUsed: number;
    mostCommonCombination: string;
  };
  issues: Array<{
    severity: 'critical' | 'warning' | 'info';
    type: string;
    message: string;
    count: number;
  }>;
}

async function getConfig(): Promise<MonitorConfig> {
  const args = process.argv.slice(2);
  const config: MonitorConfig = {
    days: 7, // Default to last 7 days
  };

  for (const arg of args) {
    if (arg.startsWith('--restaurant-id=')) {
      config.restaurantId = arg.split('=')[1];
    } else if (arg.startsWith('--days=')) {
      config.days = parseInt(arg.split('=')[1], 10);
    }
  }

  return config;
}

async function collectMetrics(config: MonitorConfig): Promise<MetricsSummary> {
  const supabaseModule = await import('@/server/supabase');
  const getServiceSupabaseClient = supabaseModule.getServiceSupabaseClient;
  const supabase = getServiceSupabaseClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - config.days);
  const endDate = new Date();

  const metrics: MetricsSummary = {
    period: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      days: config.days,
    },
    bookings: {
      total: 0,
      confirmed: 0,
      pending: 0,
      cancelled: 0,
    },
    assignments: {
      totalAssignments: 0,
      singleTable: 0,
      multiTable: 0,
      combinationUsagePercent: 0,
    },
    dataIntegrity: {
      orphanedBookings: 0,
      zoneLockedBookings: 0,
      bookingsWithoutZone: 0,
    },
    performance: {
      avgTablesPerBooking: 0,
      maxTablesUsed: 0,
      mostCommonCombination: 'N/A',
    },
    issues: [],
  };

  // Build query filters
  let bookingsQuery = supabase
    .from('bookings')
    .select('id, status, assigned_zone_id, booking_date, party_size')
    .gte('booking_date', metrics.period.start)
    .lte('booking_date', metrics.period.end);

  if (config.restaurantId) {
    bookingsQuery = bookingsQuery.eq('restaurant_id', config.restaurantId);
  }

  const { data: bookings, error: bookingsError } = await bookingsQuery;

  if (bookingsError) {
    throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
  }

  // Count bookings by status
  metrics.bookings.total = bookings?.length || 0;
  metrics.bookings.confirmed = bookings?.filter(b => b.status === 'confirmed').length || 0;
  metrics.bookings.pending = bookings?.filter(b => b.status === 'pending').length || 0;
  metrics.bookings.cancelled = bookings?.filter(b => b.status === 'cancelled').length || 0;

  // Get table assignments for all bookings
  const bookingIds = bookings?.map(b => b.id) || [];
  
  if (bookingIds.length > 0) {
    const { data: assignments, error: assignmentsError } = await supabase
      .from('booking_table_assignments')
      .select('booking_id, table_id')
      .in('booking_id', bookingIds);

    if (assignmentsError) {
      throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`);
    }

    // Analyze assignments
    const assignmentsByBooking = new Map<string, string[]>();
    assignments?.forEach(a => {
      if (!assignmentsByBooking.has(a.booking_id)) {
        assignmentsByBooking.set(a.booking_id, []);
      }
      assignmentsByBooking.get(a.booking_id)!.push(a.table_id);
    });

    metrics.assignments.totalAssignments = assignmentsByBooking.size;
    
    let totalTables = 0;
    const combinationCounts = new Map<number, number>();

    assignmentsByBooking.forEach((tables, bookingId) => {
      const tableCount = tables.length;
      totalTables += tableCount;
      
      if (tableCount === 1) {
        metrics.assignments.singleTable++;
      } else {
        metrics.assignments.multiTable++;
      }

      // Track combination sizes
      combinationCounts.set(tableCount, (combinationCounts.get(tableCount) || 0) + 1);
      
      if (tableCount > metrics.performance.maxTablesUsed) {
        metrics.performance.maxTablesUsed = tableCount;
      }
    });

    if (metrics.assignments.totalAssignments > 0) {
      metrics.performance.avgTablesPerBooking = totalTables / metrics.assignments.totalAssignments;
      metrics.assignments.combinationUsagePercent = 
        (metrics.assignments.multiTable / metrics.assignments.totalAssignments) * 100;
    }

    // Find most common combination size
    let maxCount = 0;
    let mostCommonSize = 0;
    combinationCounts.forEach((count, size) => {
      if (count > maxCount && size > 1) {
        maxCount = count;
        mostCommonSize = size;
      }
    });
    if (mostCommonSize > 0) {
      metrics.performance.mostCommonCombination = `${mostCommonSize} tables (${maxCount} bookings)`;
    }

    // Check for orphaned bookings (confirmed but no assignments)
    const confirmedBookings = bookings?.filter(b => b.status === 'confirmed') || [];
    const orphanedBookings = confirmedBookings.filter(
      b => !assignmentsByBooking.has(b.id)
    );
    metrics.dataIntegrity.orphanedBookings = orphanedBookings.length;

    if (orphanedBookings.length > 0) {
      metrics.issues.push({
        severity: 'critical',
        type: 'orphaned_bookings',
        message: 'Confirmed bookings with no table assignments detected',
        count: orphanedBookings.length,
      });
    }
  }

  // Check zone locking
  metrics.dataIntegrity.zoneLockedBookings = 
    bookings?.filter(b => b.assigned_zone_id !== null).length || 0;
  metrics.dataIntegrity.bookingsWithoutZone = 
    bookings?.filter(b => b.assigned_zone_id === null && b.status === 'confirmed').length || 0;

  // Warn if too many zone locks on pending bookings
  const pendingZoneLocked = bookings?.filter(
    b => b.status === 'pending' && b.assigned_zone_id !== null
  ).length || 0;

  if (pendingZoneLocked > 0) {
    metrics.issues.push({
      severity: 'warning',
      type: 'zone_lock_on_pending',
      message: 'Pending bookings with zone locks (may prevent flexible reassignment)',
      count: pendingZoneLocked,
    });
  }

  // Warn if combination usage is unexpectedly low/high
  if (metrics.assignments.combinationUsagePercent < 2) {
    metrics.issues.push({
      severity: 'info',
      type: 'low_combination_usage',
      message: 'Very low combination usage - may indicate adjacency issues or optimal single-table inventory',
      count: 0,
    });
  } else if (metrics.assignments.combinationUsagePercent > 30) {
    metrics.issues.push({
      severity: 'warning',
      type: 'high_combination_usage',
      message: 'High combination usage - may indicate insufficient large tables in inventory',
      count: 0,
    });
  }

  return metrics;
}

function printMetrics(metrics: MetricsSummary): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TABLE COMBINATIONS - PRODUCTION MONITORING REPORT');
  console.log('='.repeat(80));
  
  console.log(`\n📅 Period: ${metrics.period.start} to ${metrics.period.end} (${metrics.period.days} days)`);
  
  console.log('\n📝 BOOKINGS SUMMARY');
  console.log('─'.repeat(80));
  console.log(`  Total:        ${metrics.bookings.total.toLocaleString()}`);
  console.log(`  ✅ Confirmed:  ${metrics.bookings.confirmed.toLocaleString()} (${((metrics.bookings.confirmed / metrics.bookings.total) * 100).toFixed(1)}%)`);
  console.log(`  ⏳ Pending:    ${metrics.bookings.pending.toLocaleString()} (${((metrics.bookings.pending / metrics.bookings.total) * 100).toFixed(1)}%)`);
  console.log(`  ❌ Cancelled:  ${metrics.bookings.cancelled.toLocaleString()} (${((metrics.bookings.cancelled / metrics.bookings.total) * 100).toFixed(1)}%)`);
  
  console.log('\n🔗 TABLE ASSIGNMENTS');
  console.log('─'.repeat(80));
  console.log(`  Total assigned bookings: ${metrics.assignments.totalAssignments.toLocaleString()}`);
  console.log(`  Single table:            ${metrics.assignments.singleTable.toLocaleString()} (${((metrics.assignments.singleTable / Math.max(metrics.assignments.totalAssignments, 1)) * 100).toFixed(1)}%)`);
  console.log(`  Multi-table combos:      ${metrics.assignments.multiTable.toLocaleString()} (${metrics.assignments.combinationUsagePercent.toFixed(1)}%)`);
  
  console.log('\n📈 PERFORMANCE METRICS');
  console.log('─'.repeat(80));
  console.log(`  Avg tables per booking:  ${metrics.performance.avgTablesPerBooking.toFixed(2)}`);
  console.log(`  Max tables used:         ${metrics.performance.maxTablesUsed}`);
  console.log(`  Most common combo:       ${metrics.performance.mostCommonCombination}`);
  
  console.log('\n🔍 DATA INTEGRITY');
  console.log('─'.repeat(80));
  console.log(`  Orphaned bookings:       ${metrics.dataIntegrity.orphanedBookings} ${metrics.dataIntegrity.orphanedBookings > 0 ? '⚠️  CRITICAL' : '✅'}`);
  console.log(`  Zone-locked bookings:    ${metrics.dataIntegrity.zoneLockedBookings}`);
  console.log(`  Confirmed without zone:  ${metrics.dataIntegrity.bookingsWithoutZone}`);
  
  if (metrics.issues.length > 0) {
    console.log('\n⚠️  ISSUES DETECTED');
    console.log('─'.repeat(80));
    metrics.issues.forEach(issue => {
      const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`  ${icon} [${issue.severity.toUpperCase()}] ${issue.message}`);
      if (issue.count > 0) {
        console.log(`     Count: ${issue.count}`);
      }
    });
  } else {
    console.log('\n✅ NO ISSUES DETECTED - All systems normal');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('Report generated:', new Date().toISOString());
  console.log('='.repeat(80) + '\n');
}

async function generateRecommendations(metrics: MetricsSummary): Promise<void> {
  console.log('\n💡 RECOMMENDATIONS\n');
  
  const recommendations: string[] = [];
  
  // Combination usage analysis
  if (metrics.assignments.combinationUsagePercent < 2) {
    recommendations.push(
      '📊 Low combination usage (<2%): This is normal if your restaurant has well-matched table inventory. ' +
      'Consider monitoring party size distribution to ensure you have the right table mix.'
    );
  } else if (metrics.assignments.combinationUsagePercent > 30) {
    recommendations.push(
      '📊 High combination usage (>30%): Consider adding more large tables to your inventory. ' +
      'Frequent combinations may indicate insufficient capacity for common party sizes.'
    );
  } else {
    recommendations.push(
      `✅ Combination usage (${metrics.assignments.combinationUsagePercent.toFixed(1)}%) is within normal range (2-30%). ` +
      'System is optimizing seat utilization effectively.'
    );
  }
  
  // Data integrity
  if (metrics.dataIntegrity.orphanedBookings > 0) {
    recommendations.push(
      `🔴 CRITICAL: ${metrics.dataIntegrity.orphanedBookings} orphaned bookings detected. ` +
      'Run: pnpm tsx -r tsconfig-paths/register scripts/fix-orphaned-bookings.ts'
    );
  } else {
    recommendations.push('✅ No orphaned bookings - data integrity is good.');
  }
  
  // Adjacency data
  recommendations.push(
    '📋 Next step: Populate table_adjacencies table with floor plan data, then enable ' +
    'FEATURE_ALLOCATOR_REQUIRE_ADJACENCY=true for better table groupings.'
  );
  
  // Performance
  if (metrics.performance.avgTablesPerBooking > 2) {
    recommendations.push(
      `⚠️  High avg tables per booking (${metrics.performance.avgTablesPerBooking.toFixed(2)}). ` +
      'Review your table inventory - you may need more large tables.'
    );
  }
  
  recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}\n`);
  });
}

async function main() {
  try {
    const config = await getConfig();
    
    console.log('\n🔍 Collecting metrics...\n');
    const metrics = await collectMetrics(config);
    
    printMetrics(metrics);
    await generateRecommendations(metrics);
    
    // Exit with error code if critical issues found
    const hasCriticalIssues = metrics.issues.some(i => i.severity === 'critical');
    process.exit(hasCriticalIssues ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Error running monitoring script:');
    console.error(error);
    process.exit(1);
  }
}

main();
