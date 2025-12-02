const { createClient } = require('@supabase/supabase-js');

// Supabase connection
const supabaseUrl = 'https://mqtchcaavsucsdjskptc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configuration - ONLY KEEP THESE
const KEEP_RESTAURANT_ID = '486de541-a307-4414-b0b1-f774a0e4a9fa';

async function cleanupDatabase() {
  console.log('🧹 Starting Database Cleanup...\n');
  console.log('=' .repeat(60));
  console.log(`Keeping restaurant: ${KEEP_RESTAURANT_ID} (White Horse Pub)`);
  console.log('=' .repeat(60));
  
  const results = {
    deleted: {},
    errors: []
  };
  
  try {
    // IMPORTANT: Delete in correct order to avoid FK violations
    // Child tables first, then parent tables
    
    // 1. Clear observability_events first (no FK deps)
    console.log('\n1️⃣  Clearing observability_events (logs)...');
    const { data: obsDeleted, error: obsError } = await supabase
      .from('observability_events')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (obsError) {
      console.log(`   ⚠️ Could not clear observability_events: ${obsError.message}`);
    } else {
      results.deleted.observability_events = obsDeleted?.length || 0;
      console.log(`   ✓ Deleted ${results.deleted.observability_events} events`);
    }
    
    // 2. Clear audit_logs
    console.log('\n2️⃣  Clearing audit_logs...');
    const { data: auditDeleted, error: auditError } = await supabase
      .from('audit_logs')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (auditError) {
      console.log(`   ⚠️ Could not clear audit_logs: ${auditError.message}`);
    } else {
      results.deleted.audit_logs = auditDeleted?.length || 0;
      console.log(`   ✓ Deleted ${results.deleted.audit_logs} audit entries`);
    }
    
    // 3. Clear capacity_outbox
    console.log('\n3️⃣  Clearing capacity_outbox...');
    const { data: outboxDeleted, error: outboxError } = await supabase
      .from('capacity_outbox')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000')
      .select();
    
    if (outboxError) {
      console.log(`   ⚠️ Could not clear capacity_outbox: ${outboxError.message}`);
    } else {
      results.deleted.capacity_outbox = outboxDeleted?.length || 0;
      console.log(`   ✓ Deleted ${results.deleted.capacity_outbox} outbox entries`);
    }
    
    // 4. Delete booking_slots for test restaurants
    console.log('\n4️⃣  Deleting booking slots for test restaurants...');
    const { data: slotsDeleted, error: slotsError } = await supabase
      .from('booking_slots')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (slotsError) {
      console.log(`   ⚠️ Booking Slots: ${slotsError.message}`);
    } else {
      results.deleted.booking_slots = slotsDeleted?.length || 0;
      console.log(`   ✓ Deleted ${results.deleted.booking_slots} booking slots`);
    }
    
    // 5. Delete table_adjacencies for test restaurant tables
    console.log('\n5️⃣  Getting table IDs for test restaurants...');
    const { data: testTables } = await supabase
      .from('table_inventory')
      .select('id')
      .neq('restaurant_id', KEEP_RESTAURANT_ID);
    
    if (testTables && testTables.length > 0) {
      const testTableIds = testTables.map(t => t.id);
      console.log(`   Found ${testTableIds.length} test tables`);
      
      // Delete adjacencies where either table is a test table
      for (const tableId of testTableIds) {
        await supabase
          .from('table_adjacencies')
          .delete()
          .eq('table_a', tableId);
        
        await supabase
          .from('table_adjacencies')
          .delete()
          .eq('table_b', tableId);
      }
      console.log(`   ✓ Cleaned table adjacencies for test tables`);
    }
    
    // 6. Delete table_inventory for test restaurants (BEFORE zones)
    console.log('\n6️⃣  Deleting table_inventory for test restaurants...');
    const { data: tablesDeleted, error: tablesError } = await supabase
      .from('table_inventory')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (tablesError) {
      console.log(`   ⚠️ Table Inventory: ${tablesError.message}`);
    } else {
      results.deleted.table_inventory = tablesDeleted?.length || 0;
      console.log(`   ✓ Deleted ${results.deleted.table_inventory} tables`);
    }
    
    // 7. NOW delete zones for test restaurants (after table_inventory is cleared)
    console.log('\n7️⃣  Deleting zones for test restaurants...');
    const { data: zonesDeleted, error: zonesError } = await supabase
      .from('zones')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (zonesError) {
      console.log(`   ⚠️ Zones: ${zonesError.message}`);
    } else {
      results.deleted.zones = zonesDeleted?.length || 0;
      console.log(`   ✓ Deleted ${results.deleted.zones} zones`);
    }
    
    // 8. Delete restaurant_service_periods
    console.log('\n8️⃣  Deleting service periods for test restaurants...');
    const { data: periodsDeleted, error: periodsError } = await supabase
      .from('restaurant_service_periods')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (periodsError) {
      console.log(`   ⚠️ Service Periods: ${periodsError.message}`);
    } else {
      results.deleted.restaurant_service_periods = periodsDeleted?.length || 0;
      console.log(`   ✓ Deleted ${results.deleted.restaurant_service_periods} service periods`);
    }
    
    // 9. Delete restaurant_operating_hours
    console.log('\n9️⃣  Deleting operating hours for test restaurants...');
    const { data: hoursDeleted, error: hoursError } = await supabase
      .from('restaurant_operating_hours')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (hoursError) {
      console.log(`   ⚠️ Operating Hours: ${hoursError.message}`);
    } else {
      results.deleted.restaurant_operating_hours = hoursDeleted?.length || 0;
      console.log(`   ✓ Deleted ${results.deleted.restaurant_operating_hours} operating hour records`);
    }
    
    // 10. Delete allowed_capacities
    console.log('\n🔟 Deleting allowed capacities for test restaurants...');
    const { data: capacitiesDeleted, error: capacitiesError } = await supabase
      .from('allowed_capacities')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (capacitiesError) {
      console.log(`   ⚠️ Allowed Capacities: ${capacitiesError.message}`);
    } else {
      results.deleted.allowed_capacities = capacitiesDeleted?.length || 0;
      console.log(`   ✓ Deleted ${results.deleted.allowed_capacities} capacity records`);
    }
    
    // 11. Delete customers for test restaurants
    console.log('\n1️⃣1️⃣ Deleting customers for test restaurants...');
    const { data: customersDeleted, error: customersError } = await supabase
      .from('customers')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (customersError) {
      console.log(`   ⚠️ Customers: ${customersError.message}`);
    } else {
      results.deleted.customers = customersDeleted?.length || 0;
      console.log(`   ✓ Deleted ${results.deleted.customers} customers`);
    }
    
    // 12. Delete restaurant_memberships for test restaurants
    console.log('\n1️⃣2️⃣ Deleting memberships for test restaurants...');
    const { data: membershipsDeleted, error: membershipsError } = await supabase
      .from('restaurant_memberships')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (membershipsError) {
      console.log(`   ⚠️ Memberships: ${membershipsError.message}`);
    } else {
      results.deleted.restaurant_memberships = membershipsDeleted?.length || 0;
      console.log(`   ✓ Deleted ${results.deleted.restaurant_memberships} memberships`);
    }
    
    // 13. FINALLY delete test restaurants
    console.log('\n1️⃣3️⃣ Deleting test restaurants...');
    const { data: restaurantsDeleted, error: restaurantsError } = await supabase
      .from('restaurants')
      .delete()
      .neq('id', KEEP_RESTAURANT_ID)
      .select();
    
    if (restaurantsError) {
      console.log(`   ⚠️ Restaurants: ${restaurantsError.message}`);
    } else {
      results.deleted.restaurants = restaurantsDeleted?.length || 0;
      console.log(`   ✓ Deleted ${results.deleted.restaurants} test restaurants`);
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Cleanup completed!\n');
    
    // Summary
    console.log('📋 Deletion Summary:');
    for (const [table, count] of Object.entries(results.deleted)) {
      if (count > 0) {
        console.log(`   ${table}: ${count} rows deleted`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    results.errors.push(error.message);
  }
  
  return results;
}

async function getStats() {
  console.log('\n📊 Database Statistics:\n');
  
  const tables = [
    'restaurants',
    'zones', 
    'table_inventory',
    'table_adjacencies',
    'restaurant_memberships',
    'restaurant_operating_hours',
    'restaurant_service_periods',
    'booking_slots',
    'profiles',
    'customers',
    'customer_profiles',
    'observability_events',
    'audit_logs',
    'capacity_outbox',
    'booking_occasions',
    'allowed_capacities',
  ];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`  ${table}: ${count} rows`);
      }
    } catch (e) {
      // Table doesn't exist
    }
  }
}

async function main() {
  console.log('=' .repeat(60));
  console.log('🗄️  DATABASE CLEANUP - DIRECT EXECUTION (v2)');
  console.log('=' .repeat(60));
  
  console.log('\n📊 BEFORE Cleanup:');
  await getStats();
  
  // Execute cleanup
  await cleanupDatabase();
  
  console.log('\n📊 AFTER Cleanup:');
  await getStats();
  
  console.log('\n✨ Database cleanup complete!\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
