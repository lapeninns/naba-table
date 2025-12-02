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
    // 1. Delete zones for test restaurants
    console.log('\n1️⃣  Deleting zones for test restaurants...');
    const { data: zonesDeleted, error: zonesError } = await supabase
      .from('zones')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (zonesError) throw new Error(`Zones: ${zonesError.message}`);
    results.deleted.zones = zonesDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.zones} zones`);
    
    // 2. Delete table_inventory for test restaurants
    console.log('\n2️⃣  Deleting table_inventory for test restaurants...');
    const { data: tablesDeleted, error: tablesError } = await supabase
      .from('table_inventory')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (tablesError) throw new Error(`Table Inventory: ${tablesError.message}`);
    results.deleted.table_inventory = tablesDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.table_inventory} tables`);
    
    // 3. Delete restaurant_service_periods
    console.log('\n3️⃣  Deleting service periods for test restaurants...');
    const { data: periodsDeleted, error: periodsError } = await supabase
      .from('restaurant_service_periods')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (periodsError) throw new Error(`Service Periods: ${periodsError.message}`);
    results.deleted.restaurant_service_periods = periodsDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.restaurant_service_periods} service periods`);
    
    // 4. Delete restaurant_operating_hours
    console.log('\n4️⃣  Deleting operating hours for test restaurants...');
    const { data: hoursDeleted, error: hoursError } = await supabase
      .from('restaurant_operating_hours')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (hoursError) throw new Error(`Operating Hours: ${hoursError.message}`);
    results.deleted.restaurant_operating_hours = hoursDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.restaurant_operating_hours} operating hour records`);
    
    // 5. Delete booking_slots
    console.log('\n5️⃣  Deleting booking slots for test restaurants...');
    const { data: slotsDeleted, error: slotsError } = await supabase
      .from('booking_slots')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (slotsError) throw new Error(`Booking Slots: ${slotsError.message}`);
    results.deleted.booking_slots = slotsDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.booking_slots} booking slots`);
    
    // 6. Delete allowed_capacities
    console.log('\n6️⃣  Deleting allowed capacities for test restaurants...');
    const { data: capacitiesDeleted, error: capacitiesError } = await supabase
      .from('allowed_capacities')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (capacitiesError) throw new Error(`Allowed Capacities: ${capacitiesError.message}`);
    results.deleted.allowed_capacities = capacitiesDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.allowed_capacities} capacity records`);
    
    // 7. Delete restaurant_memberships
    console.log('\n7️⃣  Deleting memberships for test restaurants...');
    const { data: membershipsDeleted, error: membershipsError } = await supabase
      .from('restaurant_memberships')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (membershipsError) throw new Error(`Memberships: ${membershipsError.message}`);
    results.deleted.restaurant_memberships = membershipsDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.restaurant_memberships} memberships`);
    
    // 8. Delete customers for test restaurants
    console.log('\n8️⃣  Deleting customers for test restaurants...');
    const { data: customersDeleted, error: customersError } = await supabase
      .from('customers')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (customersError) throw new Error(`Customers: ${customersError.message}`);
    results.deleted.customers = customersDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.customers} customers`);
    
    // 9. Delete capacity_outbox entries
    console.log('\n9️⃣  Clearing capacity_outbox...');
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
    
    // 10. Delete test restaurants
    console.log('\n🔟 Deleting test restaurants...');
    const { data: restaurantsDeleted, error: restaurantsError } = await supabase
      .from('restaurants')
      .delete()
      .neq('id', KEEP_RESTAURANT_ID)
      .select();
    
    if (restaurantsError) throw new Error(`Restaurants: ${restaurantsError.message}`);
    results.deleted.restaurants = restaurantsDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.restaurants} test restaurants`);
    
    // 11. Clear observability_events
    console.log('\n1️⃣1️⃣ Clearing observability_events (logs)...');
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
    
    // 12. Clear audit_logs (optional - keeping some history might be useful)
    console.log('\n1️⃣2️⃣ Clearing audit_logs...');
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
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Cleanup completed successfully!\n');
    
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
  console.log('🗄️  DATABASE CLEANUP - DIRECT EXECUTION');
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
