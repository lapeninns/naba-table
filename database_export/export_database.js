const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase connection
const supabaseUrl = 'https://mqtchcaavsucsdjskptc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const outputDir = path.join(__dirname);

async function getTableList() {
  // We'll use known tables since information_schema isn't directly queryable via REST API
  console.log('Using known tables list...');
  return null;
}

// Actual tables from the database (extracted from migrations)
const knownTables = [
  'allocations',
  'allocations_archive',
  'allowed_capacities',
  'analytics_events',
  'audit_logs',
  'booking_assignment_idempotency',
  'booking_confirmation_results',
  'booking_occasions',
  'booking_occasions_audit',
  'booking_slots',
  'booking_state_history',
  'booking_table_assignments',
  'booking_versions',
  'bookings',
  'capacity_metrics_hourly',
  'capacity_outbox',
  'customer_profiles',
  'customers',
  'demand_profiles',
  'feature_flag_overrides',
  'leads',
  'loyalty_point_events',
  'loyalty_points',
  'loyalty_programs',
  'manual_assignment_sessions',
  'merge_group_members',
  'merge_groups',
  'merge_rules',
  'observability_events',
  'profile_update_requests',
  'profiles',
  'restaurant_capacity_rules',
  'restaurant_invites',
  'restaurant_memberships',
  'restaurant_operating_hours',
  'restaurant_service_periods',
  'restaurants',
  'service_policy',
  'strategic_configs',
  'strategic_simulation_runs',
  'stripe_events',
  'table_adjacencies',
  'table_hold_members',
  'table_hold_windows',
  'table_holds',
  'table_inventory',
  'table_scarcity_metrics',
  'user_profiles',
  'waiting_list',
  'zones',
];

async function exportTable(tableName) {
  console.log(`Exporting table: ${tableName}...`);
  
  try {
    // Get all data from the table
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .limit(10000); // Increase limit for larger tables
    
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.log(`  Table ${tableName} does not exist, skipping...`);
        return null;
      }
      console.log(`  Error exporting ${tableName}:`, error.message);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log(`  Table ${tableName} is empty`);
      return { tableName, rowCount: 0, data: [] };
    }
    
    console.log(`  Exported ${data.length} rows from ${tableName}`);
    return { tableName, rowCount: data.length, data };
  } catch (err) {
    console.log(`  Error with table ${tableName}:`, err.message);
    return null;
  }
}

async function discoverAndExportAllTables() {
  console.log('Starting database export...\n');
  console.log('=' .repeat(60));
  
  const exportResults = {
    exportedAt: new Date().toISOString(),
    supabaseUrl: supabaseUrl,
    tables: {},
    summary: {
      totalTables: 0,
      totalRows: 0,
      exportedTables: [],
      emptyTables: [],
      failedTables: []
    }
  };
  
  // Try to get table list dynamically first
  let tablesToExport = await getTableList();
  
  if (!tablesToExport) {
    console.log('Using known tables list for export...\n');
    tablesToExport = knownTables;
  } else {
    console.log(`Found ${tablesToExport.length} tables in database\n`);
  }
  
  // Export each table
  for (const tableName of tablesToExport) {
    const result = await exportTable(tableName);
    
    if (result) {
      exportResults.tables[tableName] = result;
      exportResults.summary.totalTables++;
      exportResults.summary.totalRows += result.rowCount;
      
      if (result.rowCount > 0) {
        exportResults.summary.exportedTables.push(tableName);
        
        // Save individual table file
        const tableFile = path.join(outputDir, `table_${tableName}.json`);
        fs.writeFileSync(tableFile, JSON.stringify(result, null, 2));
        console.log(`  Saved to: table_${tableName}.json`);
      } else {
        exportResults.summary.emptyTables.push(tableName);
      }
    } else {
      exportResults.summary.failedTables.push(tableName);
    }
  }
  
  // Save complete export
  const fullExportFile = path.join(outputDir, 'full_database_export.json');
  fs.writeFileSync(fullExportFile, JSON.stringify(exportResults, null, 2));
  
  // Save summary
  const summaryFile = path.join(outputDir, 'export_summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(exportResults.summary, null, 2));
  
  console.log('\n' + '=' .repeat(60));
  console.log('Export Summary:');
  console.log(`  Total Tables Processed: ${exportResults.summary.totalTables}`);
  console.log(`  Tables with Data: ${exportResults.summary.exportedTables.length}`);
  console.log(`  Empty Tables: ${exportResults.summary.emptyTables.length}`);
  console.log(`  Total Rows Exported: ${exportResults.summary.totalRows}`);
  console.log(`\nFiles saved to: ${outputDir}`);
  
  return exportResults;
}

// Run the export
discoverAndExportAllTables()
  .then(() => {
    console.log('\nExport completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Export failed:', err);
    process.exit(1);
  });
