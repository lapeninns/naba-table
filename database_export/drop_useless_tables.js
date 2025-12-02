const { createClient } = require('@supabase/supabase-js');

// Supabase connection
const supabaseUrl = 'https://mqtchcaavsucsdjskptc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Tables to DROP (useless/unused)
const TABLES_TO_DROP = [
  // Loyalty feature (not implemented)
  'loyalty_point_events',
  'loyalty_points',
  'loyalty_programs',
  
  // Unused booking tables
  'booking_assignment_idempotency',
  'booking_confirmation_results',
  'booking_versions',
  'booking_occasions_audit',
  
  // Unused table management
  'table_hold_members',
  'table_hold_windows',
  'table_scarcity_metrics',
  
  // Duplicates/unused
  'user_profiles',
  'analytics_events',
  
  // Future features not needed now
  'demand_profiles',
  'strategic_configs',
  'restaurant_capacity_rules',
];

// Tables to KEEP (core business)
const TABLES_TO_KEEP = [
  // Core Business
  'restaurants',
  'bookings',
  'customers',
  'profiles',
  'table_inventory',
  'zones',
  'booking_table_assignments',
  'booking_occasions',
  'booking_slots',
  'booking_state_history',
  'restaurant_memberships',
  'restaurant_operating_hours',
  'restaurant_service_periods',
  
  // Supporting
  'restaurant_invites',
  'allowed_capacities',
  'table_adjacencies',
  'table_holds',
  'allocations',
  'customer_profiles',
  'profile_update_requests',
  
  // Config
  'service_policy',
  'merge_rules',
  'feature_flag_overrides',
  
  // Logs (keep schema, data cleared)
  'audit_logs',
  'observability_events',
  'capacity_outbox',
];

async function dropTable(tableName) {
  console.log(`  Dropping table: ${tableName}...`);
  
  try {
    // Use RPC to execute raw SQL for dropping tables
    const { error } = await supabase.rpc('exec_sql', {
      sql: `DROP TABLE IF EXISTS "${tableName}" CASCADE;`
    });
    
    if (error) {
      // If RPC doesn't exist, we'll need to use a different approach
      if (error.message.includes('function') || error.message.includes('does not exist')) {
        console.log(`    ⚠️ Cannot drop via RPC, will need migration`);
        return { success: false, needsMigration: true };
      }
      console.log(`    ❌ Error: ${error.message}`);
      return { success: false, error: error.message };
    }
    
    console.log(`    ✓ Dropped`);
    return { success: true };
  } catch (err) {
    console.log(`    ❌ Error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function checkTableExists(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error && error.message.includes('does not exist')) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

async function getStats() {
  console.log('\n📊 Current Tables:\n');
  
  const allTables = [...TABLES_TO_KEEP, ...TABLES_TO_DROP];
  const existing = [];
  const missing = [];
  
  for (const table of allTables) {
    const exists = await checkTableExists(table);
    if (exists) {
      existing.push(table);
    } else {
      missing.push(table);
    }
  }
  
  console.log(`  Existing: ${existing.length}`);
  console.log(`  Already gone: ${missing.length}`);
  
  return { existing, missing };
}

async function main() {
  console.log('=' .repeat(60));
  console.log('🗑️  DROP USELESS TABLES');
  console.log('=' .repeat(60));
  
  console.log('\n📋 Tables to DROP:');
  TABLES_TO_DROP.forEach(t => console.log(`   ❌ ${t}`));
  
  console.log('\n📋 Tables to KEEP:');
  TABLES_TO_KEEP.forEach(t => console.log(`   ✅ ${t}`));
  
  // Check which tables exist
  console.log('\n🔍 Checking table existence...');
  
  const tablesToActuallyDrop = [];
  const tablesAlreadyGone = [];
  
  for (const table of TABLES_TO_DROP) {
    const exists = await checkTableExists(table);
    if (exists) {
      tablesToActuallyDrop.push(table);
    } else {
      tablesAlreadyGone.push(table);
    }
  }
  
  console.log(`\n  Tables that exist (to drop): ${tablesToActuallyDrop.length}`);
  tablesToActuallyDrop.forEach(t => console.log(`    - ${t}`));
  
  console.log(`\n  Tables already gone: ${tablesAlreadyGone.length}`);
  tablesAlreadyGone.forEach(t => console.log(`    - ${t}`));
  
  if (tablesToActuallyDrop.length === 0) {
    console.log('\n✨ No tables to drop - all useless tables are already gone!');
    return;
  }
  
  // Generate migration SQL
  console.log('\n' + '=' .repeat(60));
  console.log('📝 MIGRATION SQL (run in Supabase SQL Editor):');
  console.log('=' .repeat(60));
  
  console.log('\n-- Drop useless tables');
  console.log('-- Generated: ' + new Date().toISOString());
  console.log('-- Run this in Supabase SQL Editor\n');
  
  console.log('BEGIN;\n');
  
  for (const table of tablesToActuallyDrop) {
    console.log(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
  }
  
  console.log('\nCOMMIT;');
  
  console.log('\n' + '=' .repeat(60));
  
  // Save migration to file
  const migrationSQL = `-- Drop useless tables
-- Generated: ${new Date().toISOString()}
-- This removes tables that are not used in the codebase

BEGIN;

${tablesToActuallyDrop.map(t => `DROP TABLE IF EXISTS "${t}" CASCADE;`).join('\n')}

COMMIT;

-- After running, verify with:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
`;

  const fs = require('fs');
  const migrationFile = `/Users/amankumarshrestha/Downloads/SajiloReserveX/database_export/drop_useless_tables.sql`;
  fs.writeFileSync(migrationFile, migrationSQL);
  
  console.log(`\n📁 Migration saved to: drop_useless_tables.sql`);
  console.log('\n⚠️  To execute, run the SQL in Supabase Dashboard > SQL Editor');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
