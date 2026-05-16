import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

import { assertStagingScriptSafety } from './db/safety';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

assertStagingScriptSafety({
  apiUrl: SUPABASE_URL,
  expectedProjectRef: process.env.EXPECTED_PROJECT_REF ?? process.env.EXPECTED_STAGING_PROJECT_REF,
  targetEnv: process.env.DB_TARGET_ENV ?? process.env.APP_ENV,
  confirmation: process.env.CONFIRM_STAGING_BOOKING_SEED,
  confirmationName: 'CONFIRM_STAGING_BOOKING_SEED',
});

const TARGET_RESTAURANT_ID = requireEnv('RESTAURANT_ID');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const FIRST_NAMES = ['James', 'Sarah', 'Michael', 'Emma', 'David', 'Olivia'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia'];
const SEATING = ['any', 'window', 'bar', 'booth'];

function randEl<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randName(): string {
  return `${randEl(FIRST_NAMES)} ${randEl(LAST_NAMES)}`;
}

function randEmail(name: string): string {
  return `${name.toLowerCase().replace(/\s+/g, '.')}+${Date.now()}@example.com`;
}

function randPhone(): string {
  return `+447${Math.floor(Math.random() * 1000000000)
    .toString()
    .padStart(9, '0')}`;
}

function randId(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function getRestaurant(): Promise<string> {
  return TARGET_RESTAURANT_ID;
}

async function getCustomer(
  rid: string,
  name: string,
  email: string,
  phone: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('customers')
    .insert({ restaurant_id: rid, full_name: name, email, phone })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function createBooking(
  rid: string,
  cid: string,
  name: string,
  email: string,
  phone: string,
  date: string,
  start: string,
  end: string,
  party: number,
  type: 'lunch' | 'dinner',
  seat: string,
): Promise<void> {
  const ref = `STG-${randId()}`;
  const { error } = await supabase.from('bookings').insert({
    restaurant_id: rid,
    customer_id: cid,
    customer_name: name,
    customer_email: email,
    customer_phone: phone,
    booking_date: date,
    start_time: start,
    end_time: end,
    party_size: party,
    booking_type: type,
    seating_preference: seat,
    status: 'confirmed',
    source: 'api',
    reference: ref,
  });
  if (error) throw error;
}

async function seed() {
  try {
    const rid = await getRestaurant();
    console.log(`Restaurant: ${rid}\n`);

    const today = new Date(2026, 0, 21);
    let total = 0;

    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];
      const day = date.toLocaleDateString('en-US', { weekday: 'long' });

      console.log(`${day} ${dateStr}`);

      const lunchCount = 10 + Math.floor(Math.random() * 6);
      for (let i = 0; i < lunchCount; i++) {
        const min = Math.floor(Math.random() * 60)
          .toString()
          .padStart(2, '0');
        const name = randName();
        const email = randEmail(name);
        const phone = randPhone();
        const cid = await getCustomer(rid, name, email, phone);
        try {
          await createBooking(
            rid,
            cid,
            name,
            email,
            phone,
            dateStr,
            `12:${min}:00`,
            `14:${min}:00`,
            2 + Math.floor(Math.random() * 5),
            'lunch',
            randEl(SEATING),
          );
          total++;
          console.log(`  ✓ Lunch 12:${min}`);
        } catch {
          console.log(`  ✗ Lunch 12:${min}`);
        }
      }

      const dinnerCount = 10 + Math.floor(Math.random() * 6);
      for (let i = 0; i < dinnerCount; i++) {
        const min = Math.floor(Math.random() * 60)
          .toString()
          .padStart(2, '0');
        const h = 18 + Math.floor(Math.random() * 2);
        const eh = (h + 2) % 24;
        const name = randName();
        const email = randEmail(name);
        const phone = randPhone();
        const cid = await getCustomer(rid, name, email, phone);
        try {
          await createBooking(
            rid,
            cid,
            name,
            email,
            phone,
            dateStr,
            `${h.toString().padStart(2, '0')}:${min}:00`,
            `${eh.toString().padStart(2, '0')}:${min}:00`,
            2 + Math.floor(Math.random() * 5),
            'dinner',
            randEl(SEATING),
          );
          total++;
          console.log(`  ✓ Dinner ${h.toString().padStart(2, '0')}:${min}`);
        } catch {
          console.log(`  ✗ Dinner ${h.toString().padStart(2, '0')}:${min}`);
        }
      }

      console.log('');
    }

    console.log(`\n✅ Created ${total} bookings for this week`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seed();
