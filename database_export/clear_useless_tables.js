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
  'loyalty_point_events',
  'loyalty_points',
  'loyalty_programs',
  'booking_assignment_idempotency',
  'booking_confirmation_results',
  'booking_versions',
  'booking_occasions_audit',
  'table_hold_members',
  'table_hold_windows',
  'table_scarcity_metrics',
  'user_profiles',
  'analytics_events',
  'demand_profiles',
  'strategic_configs',
  'restaurant_capacity_rules',
];

async function clearTable(tableName) {
  try {
    // First try to delete all rows (this works via REST API)
    const { error } = await supabase
      .from(tableName)
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000');
    
    if (error && !error.message.includes('does not exist')) {
      // Try alternative delete approach for tables without 'id' column
      const { error: error2 } = await supabase
        .from(tableName)
        .delete()
        .neq('created_at', '1900-01-01');
      
      if (error2 && !error2.message.includes('does not exist')) {
        return { success: false, error: error2.message };
      }
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function checkTableExists(tableName) {
  try {
    const { error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error && (error.message.includes('does not exist') || error.code === '42P01')) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

async function main() {
  console.log('=' .repeat(60));
  console.log('🗑️  CLEARING USELESS TABLES');
  console.log('=' .repeat(60));
  console.log('\nNote: REST API cannot DROP tables, but can clear their data.');
  console.log('Tables will be marked for removal in next schema cleanup.\n');
  
  let cleared = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const table of TABLES_TO_DROP) {
    const exists = await checkTableExists(table);
    
    if (!exists) {
      console.log(`⏭️  ${table} - does not exist (skipped)`);
      skipped++;
      continue;
    }
    
    console.log(`🧹 Clearing ${table}...`);
    const result = await clearTable(table);
    
    if (result.success) {
      console.log(`   ✓ Cleared`);
      cleared++;
    } else {
      console.log(`   ⚠️ ${result.error}`);
      errors++;
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('Summary:');
  console.log(`  Cleared: ${cleared}`);
  console.log(`  Skipped (not exist): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log('=' .repeat(60));
  
  // Generate the SQL for dropping tables
  console.log('\n📝 To fully DROP these tables, run this SQL in Supabase Dashboard:\n');
  console.log('-- Go to: https://supabase.com/dashboard/project/mqtchcaavsucsdjskptc/sql');
  console.log('-- Paste and run:\n');
  
  for (const table of TABLES_TO_DROP) {
    console.log(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
  }
  
  console.log('\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
