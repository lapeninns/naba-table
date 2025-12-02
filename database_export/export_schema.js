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

// Tables that successfully exported data
const existingTables = [
  'allocations',
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
  'capacity_outbox',
  'customer_profiles',
  'customers',
  'demand_profiles',
  'feature_flag_overrides',
  'loyalty_point_events',
  'loyalty_points',
  'loyalty_programs',
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
  'table_adjacencies',
  'table_hold_members',
  'table_hold_windows',
  'table_holds',
  'table_inventory',
  'table_scarcity_metrics',
  'user_profiles',
  'zones',
];

async function getTableSchema(tableName) {
  try {
    // Get a single row to infer schema
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      return { error: error.message };
    }
    
    if (!data || data.length === 0) {
      // Try to get columns by selecting with no rows
      return { columns: 'Unable to determine - table is empty', tableName };
    }
    
    const columns = Object.keys(data[0]).map(key => ({
      name: key,
      sampleValue: data[0][key],
      type: typeof data[0][key],
      isNull: data[0][key] === null
    }));
    
    return { tableName, columns };
  } catch (err) {
    return { tableName, error: err.message };
  }
}

async function exportAllSchemas() {
  console.log('Extracting table schemas...\n');
  
  const schemas = {};
  
  for (const tableName of existingTables) {
    console.log(`Getting schema for: ${tableName}...`);
    const schema = await getTableSchema(tableName);
    schemas[tableName] = schema;
  }
  
  // Save schemas
  const schemaFile = path.join(outputDir, 'database_schemas.json');
  fs.writeFileSync(schemaFile, JSON.stringify(schemas, null, 2));
  
  console.log(`\nSchemas saved to: ${schemaFile}`);
  
  // Create a human-readable markdown file
  let markdown = '# Database Schema Documentation\n\n';
  markdown += `Generated: ${new Date().toISOString()}\n\n`;
  markdown += `Supabase URL: ${supabaseUrl}\n\n`;
  markdown += '---\n\n';
  
  for (const [tableName, schema] of Object.entries(schemas)) {
    markdown += `## Table: \`${tableName}\`\n\n`;
    
    if (schema.error) {
      markdown += `**Error:** ${schema.error}\n\n`;
    } else if (schema.columns && Array.isArray(schema.columns)) {
      markdown += '| Column | Type | Sample Value |\n';
      markdown += '|--------|------|-------------|\n';
      
      for (const col of schema.columns) {
        const sampleVal = col.isNull ? 'NULL' : 
          (typeof col.sampleValue === 'object' ? JSON.stringify(col.sampleValue).substring(0, 50) : String(col.sampleValue).substring(0, 50));
        markdown += `| ${col.name} | ${col.type} | ${sampleVal} |\n`;
      }
      markdown += '\n';
    } else {
      markdown += `${schema.columns || 'No schema information available'}\n\n`;
    }
    
    markdown += '---\n\n';
  }
  
  const markdownFile = path.join(outputDir, 'DATABASE_SCHEMA.md');
  fs.writeFileSync(markdownFile, markdown);
  
  console.log(`Schema documentation saved to: ${markdownFile}`);
  
  return schemas;
}

exportAllSchemas()
  .then(() => {
    console.log('\nSchema export completed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Schema export failed:', err);
    process.exit(1);
  });
