/**
 * Smart Database Seed Generator - SQL Output
 * 
 * Generates SQL INSERT statements for bookings based on restaurant configuration.
 * Run this to generate seed.sql, then apply it to your database.
 * 
 * Usage:
 *   pnpm tsx scripts/generate-smart-seed-sql.ts > supabase/seeds/smart-seed.sql
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';
import { randomBytes } from 'crypto';

const CONFIG = {
  RESTAURANT_SLUG: process.argv.find(arg => arg.startsWith('--restaurant='))?.split('=')[1] || 'prince-of-wales-pub-bromham',
  TARGET_DATE: process.argv.find(arg => arg.startsWith('--date='))?.split('=')[1] || '2025-11-10',
  BOOKING_COUNT: parseInt(process.argv.find(arg => arg.startsWith('--count='))?.split('=')[1] || '100'),
};

const PARTY_SIZE_WEIGHTS = [
  { size: 2, weight: 35 },
  { size: 3, weight: 15 },
  { size: 4, weight: 25 },
  { size: 5, weight: 10 },
  { size: 6, weight: 10 },
  { size: 7, weight: 3 },
  { size: 8, weight: 2 },
];

const SEATING_PREFERENCE_WEIGHTS = [
  { pref: 'indoor', weight: 80 },
  { pref: 'outdoor', weight: 15 },
  { pref: 'any', weight: 5 },
];

function weightedRandom<T>(items: Array<{ weight: number } & T>): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[items.length - 1]!;
}

function generateReference(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

function sqlEscape(str: string): string {
  return str.replace(/'/g, "''");
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Load restaurant
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('slug', CONFIG.RESTAURANT_SLUG)
    .single();

  if (!restaurant) throw new Error('Restaurant not found');

  // Load service periods
  const targetDate = DateTime.fromISO(CONFIG.TARGET_DATE);
  const dayOfWeek = targetDate.weekday === 7 ? 0 : targetDate.weekday;

  const { data: servicePeriods } = await supabase
    .from('restaurant_service_periods')
    .select('name, start_time, end_time, booking_option')
    .eq('restaurant_id', restaurant.id)
    .or(`day_of_week.is.null,day_of_week.eq.${dayOfWeek}`)
    .order('start_time', { ascending: true });

  if (!servicePeriods || servicePeriods.length === 0) throw new Error('No service periods found');

  // Load table stats
  const { data: tableStats } = await supabase
    .from('table_inventory')
    .select('capacity, min_party_size, max_party_size')
    .eq('restaurant_id', restaurant.id)
    .eq('active', true);

  if (!tableStats || tableStats.length === 0) throw new Error('No tables found');

  const minPartySize = Math.min(...tableStats.map(t => t.min_party_size));
  const maxPartySize = Math.max(...tableStats.map(t => t.max_party_size || t.capacity));

  const viablePartySizes = PARTY_SIZE_WEIGHTS.filter(
    ps => ps.size >= minPartySize && ps.size <= maxPartySize
  );

  // Generate time slots
  const bookingSlots: Array<{ startTime: string; endTime: string; bookingType: string }> = [];

  for (const service of servicePeriods) {
    const serviceStart = DateTime.fromISO(`${CONFIG.TARGET_DATE}T${service.start_time}`);
    const serviceEnd = DateTime.fromISO(`${CONFIG.TARGET_DATE}T${service.end_time}`);
    const typicalDuration = service.booking_option === 'drinks' ? 60 : 90;
    
    let currentSlot = serviceStart;
    while (currentSlot.plus({ minutes: typicalDuration }) <= serviceEnd) {
      const slotEnd = currentSlot.plus({ minutes: typicalDuration });
      bookingSlots.push({
        startTime: currentSlot.toFormat('HH:mm:ss'),
        endTime: slotEnd.toFormat('HH:mm:ss'),
        bookingType: service.booking_option,
      });
      currentSlot = currentSlot.plus({ minutes: 15 });
    }
  }

  // Output SQL
  console.log('-- Smart Booking Seed for ' + restaurant.name);
  console.log('-- Date: ' + CONFIG.TARGET_DATE);
  console.log('-- Generated: ' + new Date().toISOString());
  console.log('-- Bookings: ' + CONFIG.BOOKING_COUNT);
  console.log('');
  console.log('-- Clear existing bookings for this date');
  console.log(`DELETE FROM bookings WHERE restaurant_id = '${restaurant.id}' AND booking_date = '${CONFIG.TARGET_DATE}';`);
  console.log('');
  console.log('-- Create guest customers (reusable across bookings)');
  console.log('INSERT INTO customers (id, restaurant_id, full_name, email, phone) VALUES');

  const customerIds: string[] = [];
  for (let i = 0; i < Math.min(CONFIG.BOOKING_COUNT, 20); i++) {
    const customerId = randomBytes(16).toString('hex');
    const formattedId = `${customerId.substring(0,8)}-${customerId.substring(8,12)}-${customerId.substring(12,16)}-${customerId.substring(16,20)}-${customerId.substring(20,32)}`;
    customerIds.push(formattedId);
    
    const comma = i < Math.min(CONFIG.BOOKING_COUNT, 20) - 1 ? ',' : ';';
    console.log(`  ('${formattedId}', '${restaurant.id}', 'Test Customer ${i + 1}', 'test${i + 1}@example.com', '+447${Math.floor(100000000 + Math.random() * 900000000)}')${comma}`);
  }

  console.log('');
  console.log('-- Insert bookings');
  console.log('INSERT INTO bookings (restaurant_id, customer_id, booking_date, start_time, end_time, party_size, status, customer_name, customer_email, customer_phone, seating_preference, booking_type, reference, idempotency_key, source, notes) VALUES');

  for (let i = 0; i < CONFIG.BOOKING_COUNT; i++) {
    const slot = bookingSlots[Math.floor(Math.random() * bookingSlots.length)]!;
    const { size: partySize } = weightedRandom(viablePartySizes);
    const { pref: seatingPreference } = weightedRandom(SEATING_PREFERENCE_WEIGHTS);
    const customerId = customerIds[i % customerIds.length]!;
    const customerName = `Test Customer ${(i % customerIds.length) + 1}`;
    const customerEmail = `test${(i % customerIds.length) + 1}@example.com`;
    const customerPhone = `+447${Math.floor(100000000 + Math.random() * 900000000)}`;
    const reference = generateReference();
    const idempotencyKey = `gen-${Date.now()}-${randomBytes(8).toString('hex')}`;
    
    const comma = i < CONFIG.BOOKING_COUNT - 1 ? ',' : ';';
    
    console.log(`  ('${restaurant.id}', '${customerId}', '${CONFIG.TARGET_DATE}', '${slot.startTime}', '${slot.endTime}', ${partySize}, 'pending', '${customerName}', '${customerEmail}', '${customerPhone}', '${seatingPreference}', '${slot.bookingType}', '${reference}', '${idempotencyKey}', 'smart-seed', 'Auto-generated via smart seed')${comma}`);
  }

  console.log('');
  console.log('-- Seed complete');
}

main().catch(error => {
  console.error('-- Error:', error.message);
  process.exit(1);
});
