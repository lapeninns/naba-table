#!/usr/bin/env tsx
/**
 * Diagnose why large bookings (11+ people) are not getting table assignments
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

// Load env BEFORE any imports
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

async function diagnoseLargeBookingFailure() {
  const supabaseModule = await import('@/server/supabase');
  const getServiceSupabaseClient = supabaseModule.getServiceSupabaseClient;
  const supabase = getServiceSupabaseClient();

  console.log('\n🔍 Diagnosing Large Booking Assignment Failures\n');
  console.log('=' .repeat(70));

  // Check feature flags
  console.log('\n📋 Feature Flag Configuration:');
  console.log(`   FEATURE_COMBINATION_PLANNER: ${process.env.FEATURE_COMBINATION_PLANNER}`);
  console.log(`   FEATURE_ALLOCATOR_K_MAX: ${process.env.FEATURE_ALLOCATOR_K_MAX}`);
  console.log(`   FEATURE_ALLOCATOR_REQUIRE_ADJACENCY: ${process.env.FEATURE_ALLOCATOR_REQUIRE_ADJACENCY}`);
  console.log(`   FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS: ${process.env.FEATURE_SELECTOR_MAX_COMBINATION_EVALUATIONS}`);

  // Check both restaurants
  const restaurantIds = {
    'Prince of Wales Pub (Bromham)': '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a',
    'Old Crown Pub (Girton)': 'c8d0f183-936e-40b8-8055-2b9b0833840f'
  };

  for (const [name, restaurantId] of Object.entries(restaurantIds)) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`\n🏪 Restaurant: ${name}`);
    
    await analyzeRestaurant(supabase, restaurantId, name);
  }
}

type Mobility = 'movable' | 'fixed';
interface TableRow {
  id: string;
  capacity: number;
  mobility: Mobility;
  zone_id: string | null;
  zones?: { name?: string | null } | null;
}

interface BookingRow {
  id: string;
  reference: string;
  party_size: number;
  booking_date: string;
  start_time: string;
  restaurant_id: string;
  status: string;
}

async function analyzeRestaurant(supabase: any, restaurantId: string, restaurantName: string) {
  // Get a failed large booking for this restaurant
  const { data: failedBookings } = await supabase
    .from('bookings')
    .select('id, reference, party_size, booking_date, start_time, restaurant_id, status')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'pending')
    .gte('party_size', 11)
    .order('created_at', { ascending: false })
    .limit(1);

  const booking: BookingRow | null = failedBookings && failedBookings.length > 0 ? (failedBookings[0] as BookingRow) : null;
  if (booking) {
    console.log(`\n📝 Failed Booking: ${booking.reference}`);
    console.log(`   Party Size: ${booking.party_size}`);
    console.log(`   Date: ${booking.booking_date} at ${booking.start_time}`);
  } else {
    console.log('\n✅ No pending large bookings for this restaurant');
  }

  // Check table inventory for this restaurant
  const { data: tables } = await supabase
    .from('table_inventory')
    .select('id, capacity, mobility, zone_id, zones(name)')
    .eq('restaurant_id', restaurantId)
    .eq('active', true);

  console.log(`\n🪑 Table Inventory Analysis:`);
  console.log(`   Total tables: ${tables?.length || 0}`);

  if (tables) {
    // Group by mobility
    const typedTables = tables as unknown as TableRow[];
    const movableTables = typedTables.filter((t: TableRow) => t.mobility === 'movable');
    const fixedTables = typedTables.filter((t: TableRow) => t.mobility === 'fixed');

    console.log(`   Movable tables: ${movableTables.length}`);
    console.log(`   Fixed tables: ${fixedTables.length}`);

    // Group by zone
    const byZone = (typedTables as TableRow[]).reduce((acc: Record<string, TableRow[]>, t: TableRow) => {
      const zoneName = t.zones?.name || 'No zone';
      if (!acc[zoneName]) acc[zoneName] = [];
      acc[zoneName].push(t);
      return acc;
    }, {} as Record<string, TableRow[]>);

    console.log(`\n   Tables by Zone:`);
    for (const [zoneName, zoneTables] of Object.entries(byZone) as Array<[string, TableRow[]]>) {
      const movableCount = zoneTables.filter((t: TableRow) => t.mobility === 'movable').length;
      const totalCapacity = zoneTables.reduce((sum: number, t: TableRow) => sum + t.capacity, 0);
      const avgCapacity = (totalCapacity / zoneTables.length).toFixed(1);
      console.log(`      ${zoneName}: ${zoneTables.length} tables (${movableCount} movable), total capacity: ${totalCapacity}, avg: ${avgCapacity}`);
    }

    // Calculate maximum possible combination
    console.log(`\n   Maximum Combination Analysis:`);
    const kMax = parseInt(process.env.FEATURE_ALLOCATOR_K_MAX || '3', 10);
    console.log(`   Current k-max limit: ${kMax} tables`);

    // For each zone, find best k-table combination
    for (const [zoneName, zoneTables] of Object.entries(byZone) as Array<[string, TableRow[]]>) {
      const movableZoneTables = zoneTables.filter((t: TableRow) => t.mobility === 'movable');
      if (movableZoneTables.length < kMax) {
        console.log(`   ⚠️  ${zoneName}: Only ${movableZoneTables.length} movable tables (need ${kMax} for k-max)`);
        continue;
      }

      // Sort by capacity descending
      const sorted = movableZoneTables.sort((a, b) => b.capacity - a.capacity);
      const topK = sorted.slice(0, kMax);
      const topKCapacity = topK.reduce((sum: number, t: TableRow) => sum + t.capacity, 0);

      console.log(`   ${zoneName}: Top ${kMax} movable tables = ${topKCapacity} capacity`);
      if (booking) {
        if (topKCapacity >= booking.party_size) {
          console.log(`      ✅ Sufficient capacity for ${booking.party_size} people`);
        } else {
          console.log(`      ❌ Insufficient capacity (need ${booking.party_size - topKCapacity} more seats)`);
        }
      } else {
        console.log('      (No pending large booking to compare against)');
      }
    }

    // Check if we need more than k-max tables
    const largestMovableZone = (Object.entries(byZone) as Array<[string, TableRow[]]>)
      .map(([name, zoneTables]) => ({
        name,
        movableTables: zoneTables.filter((t: TableRow) => t.mobility === 'movable')
      }))
      .sort((a, b) => b.movableTables.length - a.movableTables.length)[0];

    if (largestMovableZone && booking) {
      const sorted = largestMovableZone.movableTables.sort((a, b) => b.capacity - a.capacity);
      let neededTables = 0;
      let accumulatedCapacity = 0;

      for (const table of sorted) {
        if (accumulatedCapacity >= booking.party_size) break;
        neededTables++;
        accumulatedCapacity += table.capacity;
      }

      console.log(`\n   📊 Optimal Combination (${largestMovableZone.name}):`);
      console.log(`      Tables needed: ${neededTables}`);
      console.log(`      Current k-max limit: ${kMax}`);
      if (neededTables > kMax) {
        console.log(`      ⚠️  BLOCKER: Need ${neededTables} tables but k-max is ${kMax}`);
        console.log(`      💡 FIX: Increase FEATURE_ALLOCATOR_K_MAX to at least ${neededTables}`);
      } else {
        console.log(`      ✅ k-max is sufficient`);
      }
    }
  }

  // Check for adjacency data
  const { data: adjacencies, count: adjCount } = await supabase
    .from('table_adjacencies')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId);

  console.log(`\n🔗 Adjacency Data:`);
  console.log(`   Total adjacency relationships: ${adjCount || 0}`);
  console.log(`   Adjacency requirement: ${process.env.FEATURE_ALLOCATOR_REQUIRE_ADJACENCY}`);

  if (process.env.FEATURE_ALLOCATOR_REQUIRE_ADJACENCY === 'true' && (adjCount || 0) === 0) {
    console.log(`   ⚠️  BLOCKER: Adjacency required but no data exists`);
    console.log(`   💡 FIX: Either populate adjacency data or set FEATURE_ALLOCATOR_REQUIRE_ADJACENCY=false`);
  }

  // Final diagnosis
  console.log(`\n${'='.repeat(70)}`);
  console.log('\n🎯 DIAGNOSIS SUMMARY:\n');

  const issues: string[] = [];
  const fixes: string[] = [];

  // Check k-max
  if (tables && booking) {
    const typedTables = tables as unknown as TableRow[];
    const largestZone = (Object.entries(
      typedTables.reduce((acc: Record<string, TableRow[]>, t: TableRow) => {
        const zoneName = t.zones?.name || 'No zone';
        if (!acc[zoneName]) acc[zoneName] = [];
        acc[zoneName].push(t);
        return acc;
      }, {} as Record<string, TableRow[]>)
    ) as Array<[string, TableRow[]]>)
      .map(([name, zoneTables]) => ({
        name,
        movableTables: zoneTables.filter((t: TableRow) => t.mobility === 'movable')
      }))
      .sort((a, b) => b.movableTables.length - a.movableTables.length)[0];

    if (largestZone) {
      const sorted = largestZone.movableTables.sort((a, b) => b.capacity - a.capacity);
      let neededTables = 0;
      let accumulatedCapacity = 0;

      for (const table of sorted) {
        if (accumulatedCapacity >= booking.party_size) break;
        neededTables++;
        accumulatedCapacity += table.capacity;
      }

      const kMax = parseInt(process.env.FEATURE_ALLOCATOR_K_MAX || '3', 10);
      if (neededTables > kMax) {
        issues.push(`K-max limit (${kMax}) is too low - need ${neededTables} tables`);
        fixes.push(`Increase FEATURE_ALLOCATOR_K_MAX to ${neededTables} or higher (try 5-6)`);
      }
    }
  }

  // Check adjacency
  if (process.env.FEATURE_ALLOCATOR_REQUIRE_ADJACENCY === 'true' && (adjCount || 0) === 0) {
    issues.push('Adjacency is required but no adjacency data exists');
    fixes.push('Set FEATURE_ALLOCATOR_REQUIRE_ADJACENCY=false until data is populated');
  }

  if (issues.length > 0) {
    console.log('❌ ISSUES FOUND:');
    issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
    console.log('\n💡 RECOMMENDED FIXES:');
    fixes.forEach((fix, i) => console.log(`   ${i + 1}. ${fix}`));
  } else {
    console.log('✅ No obvious configuration issues found');
    console.log('   May need to check algorithm logic or add more detailed logging');
  }

  console.log('');
}

diagnoseLargeBookingFailure().catch(console.error);
