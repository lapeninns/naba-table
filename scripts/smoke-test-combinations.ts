#!/usr/bin/env tsx
/**
 * Production Smoke Tests - Table Combinations
 * 
 * Quick validation tests before deploying to production.
 * Run this after every deployment to ensure feature is working.
 * 
 * Usage:
 *   pnpm tsx -r tsconfig-paths/register scripts/smoke-test-combinations.ts
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

// Load env BEFORE any imports
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

async function main() {
  console.log('\n🧪 SMOKE TESTS - Table Combinations Feature\n');
  console.log('='.repeat(60) + '\n');
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Feature Flags
  try {
    console.log('1. ✓ Checking feature flags...');
    const flags = await import('@/server/feature-flags');
    
    const plannerEnabled = flags.isCombinationPlannerEnabled();
    const kMax = flags.getAllocatorKMax();
    const adjacencyRequired = flags.isAllocatorAdjacencyRequired();
    
    if (!plannerEnabled) throw new Error('Combination planner not enabled');
    if (kMax < 2 || kMax > 5) throw new Error(`K-max out of range: ${kMax}`);
    
    console.log(`   - Planner: ${plannerEnabled ? '✓' : '✗'}`);
    console.log(`   - K-max: ${kMax}`);
    console.log(`   - Adjacency required: ${adjacencyRequired}`);
    testsPassed++;
  } catch (error) {
    console.log(`   ✗ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    testsFailed++;
  }
  
  // Test 2: Database Connection
  try {
    console.log('\n2. ✓ Testing database connection...');
    const supabaseModule = await import('@/server/supabase');
    const supabase = supabaseModule.getServiceSupabaseClient();
    
    const { data, error } = await supabase
      .from('restaurants')
      .select('id')
      .limit(1);
    
    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data || data.length === 0) throw new Error('No restaurants found');
    
    console.log('   - Connection OK');
    testsPassed++;
  } catch (error) {
    console.log(`   ✗ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    testsFailed++;
  }
  
  // Test 3: Table Inventory
  try {
    console.log('\n3. ✓ Checking table inventory...');
    const supabaseModule = await import('@/server/supabase');
    const supabase = supabaseModule.getServiceSupabaseClient();
    
    const { data: tables, error } = await supabase
      .from('table_inventory')
      .select('id, mobility')
      .limit(10);
    
    if (error) throw new Error(`Failed to fetch tables: ${error.message}`);
    if (!tables || tables.length === 0) throw new Error('No tables found');
    
    const movable = tables.filter((t: any) => t.mobility === 'movable').length;
    if (movable === 0) throw new Error('No movable tables');
    
    console.log(`   - Tables found: ${tables.length}`);
    console.log(`   - Movable: ${movable}`);
    testsPassed++;
  } catch (error) {
    console.log(`   ✗ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    testsFailed++;
  }
  
  // Test 4: No Orphaned Bookings
  try {
    console.log('\n4. ✓ Checking for orphaned bookings...');
    const supabaseModule = await import('@/server/supabase');
    const supabase = supabaseModule.getServiceSupabaseClient();
    
    const today = new Date().toISOString().split('T')[0];
    
    const { data: confirmed, error: bookingError } = await supabase
      .from('bookings')
      .select('id')
      .eq('status', 'confirmed')
      .gte('booking_date', today)
      .limit(100);
    
    if (bookingError) throw new Error(`Failed to fetch bookings: ${bookingError.message}`);
    
    if (confirmed && confirmed.length > 0) {
      const bookingIds = confirmed.map((b: any) => b.id);
      
      const { data: assignments, error: assignError } = await supabase
        .from('booking_table_assignments')
        .select('booking_id')
        .in('booking_id', bookingIds);
      
      if (assignError) throw new Error(`Failed to fetch assignments: ${assignError.message}`);
      
      const assignedIds = new Set(assignments?.map((a: any) => a.booking_id) || []);
      const orphans = confirmed.filter((b: any) => !assignedIds.has(b.id));
      
      if (orphans.length > 0) {
        throw new Error(`${orphans.length} orphaned bookings found - run fix-orphaned-bookings.ts`);
      }
      
      console.log(`   - Confirmed bookings: ${confirmed.length}`);
      console.log(`   - All have assignments ✓`);
    } else {
      console.log('   - No confirmed bookings (OK for new install)');
    }
    testsPassed++;
  } catch (error) {
    console.log(`   ✗ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    testsFailed++;
  }
  
  // Test 5: Adjacency Consistency
  try {
    console.log('\n5. ✓ Checking adjacency data...');
    const supabaseModule = await import('@/server/supabase');
    const supabase = supabaseModule.getServiceSupabaseClient();
    const flags = await import('@/server/feature-flags');
    
    const adjacencyRequired = flags.isAllocatorAdjacencyRequired();
    
    const { data: adjacencies, error } = await supabase
      .from('table_adjacencies')
      .select('table_a')
      .limit(1);
    
    if (error) throw new Error(`Failed to check adjacencies: ${error.message}`);
    
    const hasData = adjacencies && adjacencies.length > 0;
    
    if (adjacencyRequired && !hasData) {
      throw new Error('Adjacency required but no data - populate table_adjacencies or set FEATURE_ALLOCATOR_REQUIRE_ADJACENCY=false');
    }
    
    console.log(`   - Adjacency required: ${adjacencyRequired}`);
    console.log(`   - Adjacency data exists: ${hasData}`);
    if (!adjacencyRequired && hasData) {
      console.log('   - WARNING: Data exists but requirement disabled');
    }
    testsPassed++;
  } catch (error) {
    console.log(`   ✗ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    testsFailed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('='.repeat(60) + '\n');
  
  if (testsFailed > 0) {
    console.log('❌ SMOKE TESTS FAILED - Fix issues before deploying\n');
    process.exit(1);
  } else {
    console.log('✅ ALL TESTS PASSED - Ready for deployment\n');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('\n❌ Smoke tests crashed:');
  console.error(error);
  process.exit(1);
});
