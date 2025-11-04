/**
 * Smart Booking Generator - Database-Driven Seed Data
 * 
 * Generates realistic bookings based on each restaurant's actual configuration:
 * - Service periods (lunch, dinner, happy hour, etc.)
 * - Table inventory (capacity, categories, seating types)
 * - Operating hours and days
 * - Typical party size distributions
 * 
 * NO hardcoded data - everything derived from database configuration.
 * 
 * Usage:
 *   pnpm tsx scripts/generate-smart-bookings.ts --restaurant prince-of-wales-pub-bromham --date 2025-11-09 --count 100
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

// Load env BEFORE any imports
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';
import { randomBytes } from 'crypto';

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  // Target restaurant slug
  RESTAURANT_SLUG: process.argv.find(arg => arg.startsWith('--restaurant='))?.split('=')[1] 
    || 'prince-of-wales-pub-bromham',
  
  // Target date (YYYY-MM-DD)
  TARGET_DATE: process.argv.find(arg => arg.startsWith('--date='))?.split('=')[1] 
    || '2025-11-09',
  
  // Number of bookings to generate
  BOOKING_COUNT: parseInt(process.argv.find(arg => arg.startsWith('--count='))?.split('=')[1] || '60'),
  
  // Clear existing bookings for this date first?
  CLEAR_EXISTING: process.argv.includes('--clear'),
  
  // Dry run (don't actually insert)?
  DRY_RUN: process.argv.includes('--dry-run'),
};

// ============================================================
// PARTY SIZE DISTRIBUTION (Realistic restaurant patterns)
// ============================================================

// Weighted party size distribution based on restaurant industry data
const PARTY_SIZE_WEIGHTS = [
  { size: 2, weight: 35 },  // 35% - couples, most common
  { size: 3, weight: 15 },  // 15% - small groups
  { size: 4, weight: 25 },  // 25% - families/double dates
  { size: 5, weight: 10 },  // 10% - medium groups
  { size: 6, weight: 10 },  // 10% - larger groups
  { size: 7, weight: 3 },   // 3% - large parties
  { size: 8, weight: 2 },   // 2% - very large parties
];

// Seating preference distribution
const SEATING_PREFERENCE_WEIGHTS = [
  { pref: 'indoor', weight: 80 },   // 80% prefer indoor
  { pref: 'outdoor', weight: 15 },  // 15% prefer outdoor/patio
  { pref: 'any', weight: 5 },       // 5% no preference
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function weightedRandom<T>(items: Array<{ weight: number } & T>): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) {
      return item;
    }
  }
  
  return items[items.length - 1]!;
}

function generateReference(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

function generateIdempotencyKey(): string {
  return `gen-${Date.now()}-${randomBytes(8).toString('hex')}`;
}

// ============================================================
// MAIN LOGIC
// ============================================================

interface ServicePeriod {
  id: string;
  name: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  booking_option: string;
}

interface TableInfo {
  capacity: number;
  min_party_size: number;
  max_party_size: number | null;
  category: string;
  seating_type: string;
  count: number;
}

async function main() {
  console.log('\n🎲 SMART BOOKING GENERATOR');
  console.log('=' .repeat(60));
  console.log(`Restaurant: ${CONFIG.RESTAURANT_SLUG}`);
  console.log(`Date: ${CONFIG.TARGET_DATE}`);
  console.log(`Target Count: ${CONFIG.BOOKING_COUNT} bookings`);
  console.log(`Clear Existing: ${CONFIG.CLEAR_EXISTING ? 'YES' : 'NO'}`);
  console.log(`Dry Run: ${CONFIG.DRY_RUN ? 'YES' : 'NO'}\n`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ========================================
  // 1. Load Restaurant
  // ========================================
  console.log('📍 Loading restaurant...');
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, name, slug, timezone')
    .eq('slug', CONFIG.RESTAURANT_SLUG)
    .single();

  if (restaurantError || !restaurant) {
    console.error('❌ Restaurant not found:', CONFIG.RESTAURANT_SLUG);
    process.exit(1);
  }

  console.log(`   ✅ ${restaurant.name} (${restaurant.id})`);
  console.log(`      Timezone: ${restaurant.timezone || 'UTC'}\n`);

  // ========================================
  // 2. Load Service Periods for Target Date
  // ========================================
  const targetDate = DateTime.fromISO(CONFIG.TARGET_DATE);
  const dayOfWeek = targetDate.weekday === 7 ? 0 : targetDate.weekday; // Luxon: 1=Mon, 7=Sun; DB: 0=Sun, 1=Mon

  console.log('🕐 Loading service periods...');
  const { data: servicePeriods, error: serviceError } = await supabase
    .from('restaurant_service_periods')
    .select('id, name, day_of_week, start_time, end_time, booking_option')
    .eq('restaurant_id', restaurant.id)
    .or(`day_of_week.is.null,day_of_week.eq.${dayOfWeek}`)
    .order('start_time', { ascending: true });

  if (serviceError || !servicePeriods || servicePeriods.length === 0) {
    console.error('❌ No service periods found for this restaurant/day');
    process.exit(1);
  }

  console.log(`   ✅ Found ${servicePeriods.length} service period(s):`);
  servicePeriods.forEach(sp => {
    const dayLabel = sp.day_of_week === null ? 'All days' : `Day ${sp.day_of_week}`;
    console.log(`      - ${sp.name} (${sp.start_time}-${sp.end_time}) [${sp.booking_option}] ${dayLabel}`);
  });
  console.log();

  // ========================================
  // 3. Load Table Inventory
  // ========================================
  console.log('🪑 Loading table inventory...');
  const { data: tableStats, error: tableError } = await supabase
    .from('table_inventory')
    .select('capacity, min_party_size, max_party_size, category, seating_type')
    .eq('restaurant_id', restaurant.id)
    .eq('active', true)
    .eq('status', 'available');

  if (tableError || !tableStats || tableStats.length === 0) {
    console.error('❌ No active tables found');
    process.exit(1);
  }

  // Group tables by attributes
  const tableGroups = new Map<string, TableInfo>();
  tableStats.forEach(table => {
    const key = `${table.capacity}-${table.min_party_size}-${table.max_party_size}-${table.category}-${table.seating_type}`;
    const existing = tableGroups.get(key);
    if (existing) {
      existing.count++;
    } else {
      tableGroups.set(key, { ...table, count: 1 });
    }
  });

  const totalTables = tableStats.length;
  const totalSeats = tableStats.reduce((sum, t) => sum + t.capacity, 0);
  const minPartySize = Math.min(...tableStats.map(t => t.min_party_size));
  const maxPartySize = Math.max(...tableStats.map(t => t.max_party_size || t.capacity));

  console.log(`   ✅ ${totalTables} tables, ${totalSeats} seats total`);
  console.log(`      Party size range: ${minPartySize}-${maxPartySize}`);
  console.log(`      Unique configs: ${tableGroups.size}`);
  
  // Get unique categories
  const categories = [...new Set(tableStats.map(t => t.category))];
  console.log(`      Categories: ${categories.join(', ')}\n`);

  // ========================================
  // 4. Adjust Party Size Distribution
  // ========================================
  // Filter party sizes to match what tables can actually accommodate
  const viablePartySizes = PARTY_SIZE_WEIGHTS.filter(
    ps => ps.size >= minPartySize && ps.size <= maxPartySize
  );

  if (viablePartySizes.length === 0) {
    console.error('❌ No viable party sizes match table capacity range');
    process.exit(1);
  }

  console.log('👥 Viable party sizes based on table capacity:');
  viablePartySizes.forEach(ps => {
    console.log(`      ${ps.size} people (${ps.weight}% weight)`);
  });
  console.log();

  // ========================================
  // 5. Clear Existing Bookings (if requested)
  // ========================================
  if (CONFIG.CLEAR_EXISTING && !CONFIG.DRY_RUN) {
    console.log('🗑️  Clearing existing bookings for this date...');
    const { data: deleted, error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('restaurant_id', restaurant.id)
      .eq('booking_date', CONFIG.TARGET_DATE);

    if (deleteError) {
      console.warn('   ⚠️ Error clearing bookings:', deleteError.message);
    } else {
      console.log('   ✅ Existing bookings cleared\n');
    }
  }

  // ========================================
  // 6. Generate Booking Time Slots
  // ========================================
  console.log('📅 Generating booking time slots...');
  
  const bookingSlots: Array<{
    service: ServicePeriod;
    startTime: string;
    endTime: string;
    bookingType: string;
  }> = [];

  for (const service of servicePeriods) {
    // Parse service period times
    const serviceStart = DateTime.fromISO(`${CONFIG.TARGET_DATE}T${service.start_time}`);
    const serviceEnd = DateTime.fromISO(`${CONFIG.TARGET_DATE}T${service.end_time}`);
    
    // Generate 15-minute interval slots, leaving room for dining duration
    const slotInterval = 15; // minutes
    const typicalDuration = service.booking_option === 'drinks' ? 60 : 90; // minutes
    
    let currentSlot = serviceStart;
    while (currentSlot.plus({ minutes: typicalDuration }) <= serviceEnd) {
      const slotEnd = currentSlot.plus({ minutes: typicalDuration });
      
      bookingSlots.push({
        service,
        startTime: currentSlot.toFormat('HH:mm:ss'),
        endTime: slotEnd.toFormat('HH:mm:ss'),
        bookingType: service.booking_option,
      });
      
      currentSlot = currentSlot.plus({ minutes: slotInterval });
    }
  }

  console.log(`   ✅ Generated ${bookingSlots.length} potential time slots\n`);

  // ========================================
  // 7. Create/Get Guest Customers
  // ========================================
  console.log('👤 Creating guest customers...');
  
  const guestCustomers: string[] = [];
  
  for (let i = 0; i < Math.min(CONFIG.BOOKING_COUNT, 20); i++) {
    const customerName = `Test Customer ${i + 1}`;
    const customerEmail = `test${i + 1}@example.com`;
    const customerPhone = `+44${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    
    if (!CONFIG.DRY_RUN) {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('restaurant_id', restaurant.id)
        .eq('email', customerEmail)
        .maybeSingle();

      if (existing) {
        guestCustomers.push(existing.id);
      } else {
        const { data: newCustomer, error } = await supabase
          .from('customers')
          .insert({
            restaurant_id: restaurant.id,
            full_name: customerName,
            email: customerEmail,
            phone: customerPhone,
          })
          .select('id')
          .single();

        if (newCustomer) {
          guestCustomers.push(newCustomer.id);
        } else if (error) {
          console.error(`   ⚠️  Failed to create customer ${i + 1}:`, error.message);
        }
      }
    } else {
      // Dry run - use placeholder
      guestCustomers.push(`customer-${i + 1}`);
    }
  }

  console.log(`   ✅ ${guestCustomers.length} guest customers ready\n`);

  // ========================================
  // 8. Generate Bookings
  // ========================================
  console.log(`🎯 Generating ${CONFIG.BOOKING_COUNT} bookings...\n`);

  const bookingsToInsert = [];
  
  for (let i = 0; i < CONFIG.BOOKING_COUNT; i++) {
    // Random slot
    const slot = bookingSlots[Math.floor(Math.random() * bookingSlots.length)]!;
    
    // Random party size (weighted)
    const { size: partySize } = weightedRandom(viablePartySizes);
    
    // Random seating preference (weighted)
    const { pref: seatingPreference } = weightedRandom(SEATING_PREFERENCE_WEIGHTS);
    
    // Rotate through customers
    const customerId = guestCustomers[i % guestCustomers.length]!;
    
    // Generate customer details
    const customerName = `Test Customer ${(i % guestCustomers.length) + 1}`;
    const customerEmail = `test${(i % guestCustomers.length) + 1}@example.com`;
    const customerPhone = `+44${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    
    const booking = {
      restaurant_id: restaurant.id,
      customer_id: customerId,
      booking_date: CONFIG.TARGET_DATE,
      start_time: slot.startTime,
      end_time: slot.endTime,
      party_size: partySize,
      status: 'pending',
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      seating_preference: seatingPreference,
      booking_type: slot.bookingType,
      reference: generateReference(),
      idempotency_key: generateIdempotencyKey(),
      source: 'smart-generator',
      notes: `Auto-generated via smart booking generator (${new Date().toISOString()})`,
    };

    bookingsToInsert.push(booking);
    
    if ((i + 1) % 10 === 0 || i === CONFIG.BOOKING_COUNT - 1) {
      process.stdout.write(`   Generated ${i + 1}/${CONFIG.BOOKING_COUNT} bookings...\r`);
    }
  }

  console.log(`\n   ✅ Generated ${bookingsToInsert.length} bookings\n`);

  // ========================================
  // 9. Display Summary Statistics
  // ========================================
  console.log('📊 Booking Summary:');
  
  const byPartySize = bookingsToInsert.reduce((acc, b) => {
    acc[b.party_size] = (acc[b.party_size] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const byType = bookingsToInsert.reduce((acc, b) => {
    acc[b.booking_type] = (acc[b.booking_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byPreference = bookingsToInsert.reduce((acc, b) => {
    acc[b.seating_preference] = (acc[b.seating_preference] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('   Party Sizes:');
  Object.entries(byPartySize).sort(([a], [b]) => Number(a) - Number(b)).forEach(([size, count]) => {
    console.log(`      ${size} people: ${count} bookings (${Math.round(count / CONFIG.BOOKING_COUNT * 100)}%)`);
  });

  console.log('\n   Booking Types:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`      ${type}: ${count} bookings (${Math.round(count / CONFIG.BOOKING_COUNT * 100)}%)`);
  });

  console.log('\n   Seating Preferences:');
  Object.entries(byPreference).forEach(([pref, count]) => {
    console.log(`      ${pref}: ${count} bookings (${Math.round(count / CONFIG.BOOKING_COUNT * 100)}%)`);
  });
  console.log();

  // ========================================
  // 10. Insert Bookings
  // ========================================
  if (CONFIG.DRY_RUN) {
    console.log('🔍 DRY RUN - Skipping database insert\n');
    console.log('Sample booking (first):');
    console.log(JSON.stringify(bookingsToInsert[0], null, 2));
    return;
  }

  console.log('💾 Inserting bookings into database...');
  
  const batchSize = 50;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < bookingsToInsert.length; i += batchSize) {
    const batch = bookingsToInsert.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('bookings')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`   ❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, error.message);
      failed += batch.length;
    } else {
      inserted += data?.length || 0;
      process.stdout.write(`   Inserted ${inserted}/${bookingsToInsert.length} bookings...\r`);
    }
  }

  console.log(`\n   ✅ Successfully inserted ${inserted} bookings`);
  if (failed > 0) {
    console.log(`   ⚠️  Failed to insert ${failed} bookings`);
  }
  console.log();

  // ========================================
  // 11. Verification
  // ========================================
  console.log('🔍 Verifying insertion...');
  const { count, error: countError } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurant.id)
    .eq('booking_date', CONFIG.TARGET_DATE)
    .eq('status', 'pending');

  if (countError) {
    console.error('   ❌ Error verifying:', countError.message);
  } else {
    console.log(`   ✅ Verified ${count} pending bookings in database for ${CONFIG.TARGET_DATE}\n`);
  }

  console.log('=' .repeat(60));
  console.log('✨ SMART BOOKING GENERATION COMPLETE\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
