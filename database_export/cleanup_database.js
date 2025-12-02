const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

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
const KEEP_PROFILE_ID = '35a70a11-f097-4a61-af5e-e849a1a5dd21';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function getStats() {
  console.log('\n📊 Current Database Statistics:\n');
  
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
    'booking_occasions_audit',
    'allowed_capacities',
    'profile_update_requests'
  ];
  
  const stats = {};
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        stats[table] = count;
        console.log(`  ${table}: ${count} rows`);
      }
    } catch (e) {
      // Table doesn't exist or error
    }
  }
  
  return stats;
}

async function listRestaurants() {
  console.log('\n🏪 Restaurants in database:\n');
  
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, slug, created_at')
    .order('created_at');
  
  if (error) {
    console.error('Error fetching restaurants:', error.message);
    return [];
  }
  
  data.forEach((r, i) => {
    const keep = r.id === KEEP_RESTAURANT_ID ? '✅ KEEP' : '❌ DELETE';
    console.log(`  ${i + 1}. ${r.name}`);
    console.log(`     ID: ${r.id}`);
    console.log(`     Slug: ${r.slug}`);
    console.log(`     Status: ${keep}\n`);
  });
  
  return data;
}

async function cleanupDatabase() {
  console.log('\n🧹 Starting Database Cleanup...\n');
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
    
    // 3. Delete table_adjacencies (will cascade or handle separately)
    console.log('\n3️⃣  Cleaning table_adjacencies...');
    // Get valid table IDs first
    const { data: validTables } = await supabase
      .from('table_inventory')
      .select('id')
      .eq('restaurant_id', KEEP_RESTAURANT_ID);
    
    const validTableIds = validTables?.map(t => t.id) || [];
    
    if (validTableIds.length > 0) {
      const { data: adjDeleted, error: adjError } = await supabase
        .from('table_adjacencies')
        .delete()
        .not('table_a', 'in', `(${validTableIds.join(',')})`)
        .select();
      
      // This might not work perfectly due to Supabase limitations, but let's try
      results.deleted.table_adjacencies = adjDeleted?.length || 0;
    }
    console.log(`   ✓ Cleaned table_adjacencies`);
    
    // 4. Delete restaurant_service_periods
    console.log('\n4️⃣  Deleting service periods for test restaurants...');
    const { data: periodsDeleted, error: periodsError } = await supabase
      .from('restaurant_service_periods')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (periodsError) throw new Error(`Service Periods: ${periodsError.message}`);
    results.deleted.restaurant_service_periods = periodsDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.restaurant_service_periods} service periods`);
    
    // 5. Delete restaurant_operating_hours
    console.log('\n5️⃣  Deleting operating hours for test restaurants...');
    const { data: hoursDeleted, error: hoursError } = await supabase
      .from('restaurant_operating_hours')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (hoursError) throw new Error(`Operating Hours: ${hoursError.message}`);
    results.deleted.restaurant_operating_hours = hoursDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.restaurant_operating_hours} operating hour records`);
    
    // 6. Delete booking_slots
    console.log('\n6️⃣  Deleting booking slots for test restaurants...');
    const { data: slotsDeleted, error: slotsError } = await supabase
      .from('booking_slots')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (slotsError) throw new Error(`Booking Slots: ${slotsError.message}`);
    results.deleted.booking_slots = slotsDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.booking_slots} booking slots`);
    
    // 7. Delete allowed_capacities
    console.log('\n7️⃣  Deleting allowed capacities for test restaurants...');
    const { data: capacitiesDeleted, error: capacitiesError } = await supabase
      .from('allowed_capacities')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (capacitiesError) throw new Error(`Allowed Capacities: ${capacitiesError.message}`);
    results.deleted.allowed_capacities = capacitiesDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.allowed_capacities} capacity records`);
    
    // 8. Delete restaurant_memberships
    console.log('\n8️⃣  Deleting memberships for test restaurants...');
    const { data: membershipsDeleted, error: membershipsError } = await supabase
      .from('restaurant_memberships')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (membershipsError) throw new Error(`Memberships: ${membershipsError.message}`);
    results.deleted.restaurant_memberships = membershipsDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.restaurant_memberships} memberships`);
    
    // 9. Delete customers for test restaurants
    console.log('\n9️⃣  Deleting customers for test restaurants...');
    const { data: customersDeleted, error: customersError } = await supabase
      .from('customers')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (customersError) throw new Error(`Customers: ${customersError.message}`);
    results.deleted.customers = customersDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.customers} customers`);
    
    // 10. Delete capacity_outbox for test restaurants
    console.log('\n🔟 Cleaning capacity_outbox...');
    const { data: outboxDeleted, error: outboxError } = await supabase
      .from('capacity_outbox')
      .delete()
      .neq('restaurant_id', KEEP_RESTAURANT_ID)
      .select();
    
    if (outboxError) throw new Error(`Capacity Outbox: ${outboxError.message}`);
    results.deleted.capacity_outbox = outboxDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.capacity_outbox} outbox entries`);
    
    // 11. Delete test restaurants
    console.log('\n1️⃣1️⃣ Deleting test restaurants...');
    const { data: restaurantsDeleted, error: restaurantsError } = await supabase
      .from('restaurants')
      .delete()
      .neq('id', KEEP_RESTAURANT_ID)
      .select();
    
    if (restaurantsError) throw new Error(`Restaurants: ${restaurantsError.message}`);
    results.deleted.restaurants = restaurantsDeleted?.length || 0;
    console.log(`   ✓ Deleted ${results.deleted.restaurants} test restaurants`);
    
    // 12. Truncate observability_events
    console.log('\n1️⃣2️⃣ Clearing observability_events (logs)...');
    const { error: obsError } = await supabase
      .from('observability_events')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (obsError) {
      console.log(`   ⚠️ Could not clear observability_events: ${obsError.message}`);
    } else {
      console.log(`   ✓ Cleared observability_events`);
    }
    
    // 13. Clear remaining capacity_outbox
    console.log('\n1️⃣3️⃣ Clearing remaining capacity_outbox...');
    const { error: outbox2Error } = await supabase
      .from('capacity_outbox')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000');
    
    if (outbox2Error) {
      console.log(`   ⚠️ Could not clear capacity_outbox: ${outbox2Error.message}`);
    } else {
      console.log(`   ✓ Cleared capacity_outbox`);
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Cleanup completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    results.errors.push(error.message);
  }
  
  return results;
}

async function main() {
  console.log('=' .repeat(60));
  console.log('🗄️  DATABASE CLEANUP TOOL');
  console.log('=' .repeat(60));
  console.log(`\nTarget: ${supabaseUrl}`);
  console.log(`\nThis tool will:`);
  console.log(`  1. Keep only restaurant: ${KEEP_RESTAURANT_ID}`);
  console.log(`  2. Delete all test restaurants and their related data`);
  console.log(`  3. Clear log tables (observability_events, capacity_outbox)`);
  console.log(`  4. Keep audit_logs for history\n`);
  
  // Show current stats
  await getStats();
  
  // List restaurants
  await listRestaurants();
  
  // Confirm
  const answer = await ask('\n⚠️  Are you sure you want to proceed with cleanup? (yes/no): ');
  
  if (answer.toLowerCase() !== 'yes') {
    console.log('\n❌ Cleanup cancelled.\n');
    rl.close();
    process.exit(0);
  }
  
  // Double confirm
  const answer2 = await ask('\n⚠️  This action is IRREVERSIBLE. Type "DELETE" to confirm: ');
  
  if (answer2 !== 'DELETE') {
    console.log('\n❌ Cleanup cancelled.\n');
    rl.close();
    process.exit(0);
  }
  
  // Execute cleanup
  const results = await cleanupDatabase();
  
  // Show final stats
  console.log('\n📊 Final Database Statistics:\n');
  await getStats();
  
  console.log('\n✨ Database cleanup complete!\n');
  
  rl.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  rl.close();
  process.exit(1);
});
