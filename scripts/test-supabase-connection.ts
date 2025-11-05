#!/usr/bin/env tsx
/**
 * Test Supabase connection to verify we're hitting the correct remote database
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

// Load env BEFORE any imports
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

console.log('\n🔍 Testing Supabase Connection\n');
console.log('Environment variables:');
console.log('  NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '***' + process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-10) : 'NOT SET');

async function testConnection() {
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  console.log('\n📊 Testing queries:\n');
  
  // Test 1: Count tables
  const { data: tableCount, error: error1 } = await supabase
    .from('table_inventory')
    .select('*', { count: 'exact', head: true });
    
  console.log('1. Total table_inventory rows:', tableCount, error1 || '');
  
  // Test 2: Check specific restaurant
  const { data: tables, error: error2, count } = await supabase
    .from('table_inventory')
    .select('id, capacity, mobility, active', { count: 'exact' })
    .eq('restaurant_id', '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a')
    .eq('active', true)
    .limit(5);
    
  console.log('2. Prince of Wales Pub tables:', count, 'rows');
  console.log('   Sample:', tables?.slice(0, 2));
  console.log('   Error:', error2 || 'none');
  
  // Test 3: Check if column name issue
  const { data: raw } = await supabase
    .rpc('exec_sql', { query: "SELECT column_name FROM information_schema.columns WHERE table_name='table_inventory' AND column_name LIKE '%active%'" })
    .select();
    
  console.log('3. Active column check:', raw);
}

testConnection().catch(console.error);
