#!/usr/bin/env tsx

/**
 * Test script to verify restaurant listing works
 * Run with: pnpm tsx scripts/test-restaurant-listing.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.development') });
config({ path: resolve(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅ Set' : '❌ Missing');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
  process.exit(1);
}

async function testRestaurantListing() {
  console.log('🔍 Testing Restaurant Listing...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Test 1: Check if we can connect
    console.log('Test 1: Connection test...');
    const { data: healthCheck, error: healthError } = await supabase
      .from('restaurants')
      .select('count', { count: 'exact', head: true });

    if (healthError) {
      console.error('❌ Connection failed:', healthError.message);
      console.error('   Details:', healthError);
      return false;
    }
    console.log('✅ Connected to Supabase\n');

    // Test 2: Count restaurants
    console.log('Test 2: Count restaurants...');
    const { count, error: countError } = await supabase
      .from('restaurants')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Count failed:', countError.message);
      console.error('   Details:', countError);
      return false;
    }
    console.log(`✅ Found ${count} restaurant(s)\n`);

    if (count === 0) {
      console.warn('⚠️  No restaurants in database. Run SEED_RESTAURANTS.sql to add sample data.\n');
    }

    // Test 3: List restaurants (same query as listRestaurants())
    console.log('Test 3: List restaurants...');
    const { data, error } = await supabase
      .from('restaurants')
      .select('id,name,slug,timezone,capacity')
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ Query failed:', error.message);
      console.error('   Code:', error.code);
      console.error('   Details:', error.details);
      console.error('   Hint:', error.hint);
      return false;
    }

    console.log('✅ Query successful!\n');
    
    if (data && data.length > 0) {
      console.log('📋 Restaurants:');
      data.forEach((restaurant, index) => {
        console.log(`   ${index + 1}. ${restaurant.name}`);
        console.log(`      - Slug: ${restaurant.slug}`);
        console.log(`      - Timezone: ${restaurant.timezone}`);
        console.log(`      - Capacity: ${restaurant.capacity ?? 'N/A'}`);
        console.log(`      - ID: ${restaurant.id}`);
      });
    } else {
      console.log('📋 No restaurants returned (empty result set)');
    }

    console.log('\n✅ All tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

// Run the test
testRestaurantListing()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
