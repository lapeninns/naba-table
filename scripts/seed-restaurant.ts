import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_STAGING_PROJECT_REF, assertStagingScriptSafety } from './db/safety';
import type { Database } from '../types/supabase';

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '..');
const envLocalPath = path.join(projectRoot, '.env.local');

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

type CreateRestaurantInput = {
  name: string;
  slug?: string;
  timezone: string;
  capacity?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  googleMapUrl?: string | null;
  googleReviewUrl?: string | null;
  bookingPolicy?: string | null;
  logoUrl?: string | null;
  emailSendReminder24h?: boolean;
  emailSendReminderShort?: boolean;
  emailSendReviewRequest?: boolean;
  reservationIntervalMinutes?: number;
  reservationDefaultDurationMinutes?: number;
  reservationLastSeatingBufferMinutes?: number;
  reservationLifecycleGraceMinutes?: number;
};

const ADJECTIVES = [
  'Golden',
  'Crimson',
  'Velvet',
  'Saffron',
  'Juniper',
  'Copper',
  'Harbor',
  'Maple',
];
const NOUNS = ['Fork', 'Table', 'Bistro', 'Kitchen', 'Tavern', 'Terrace', 'Pantry', 'Canteen'];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function assertSeedRestaurantSafety(): void {
  assertStagingScriptSafety({
    apiUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    expectedProjectRef: process.env.EXPECTED_STAGING_PROJECT_REF ?? DEFAULT_STAGING_PROJECT_REF,
    targetEnv: process.env.DB_TARGET_ENV ?? process.env.APP_ENV,
    confirmation: process.env.CONFIRM_STAGING_RESTAURANT_SEED,
    confirmationName: 'CONFIRM_STAGING_RESTAURANT_SEED',
  });
}

function buildSeedInput(): CreateRestaurantInput {
  const suffix = Math.random().toString(36).slice(2, 6);
  const name = `${pickRandom(ADJECTIVES)} ${pickRandom(NOUNS)} ${suffix.toUpperCase()}`;
  const address = '24 Market Lane, Bristol BS1 4ST';
  const mapQuery = encodeURIComponent(address);

  return {
    name,
    timezone: 'Europe/London',
    capacity: 84,
    contactEmail: `hello+${suffix}@example.com`,
    contactPhone: '+44 117 000 1234',
    address,
    googleMapUrl: `https://maps.google.com/?q=${mapQuery}`,
    googleReviewUrl: `https://search.google.com/local/reviews?placeid=placeholder-${suffix}`,
    bookingPolicy:
      'Please arrive on time. We hold tables for 15 minutes and accommodate dietary needs with advance notice.',
    logoUrl: 'https://placehold.co/256x256/png?text=Restaurant',
    emailSendReminder24h: true,
    emailSendReminderShort: true,
    emailSendReviewRequest: true,
    reservationIntervalMinutes: 15,
    reservationDefaultDurationMinutes: 90,
    reservationLastSeatingBufferMinutes: 30,
    reservationLifecycleGraceMinutes: 30,
  };
}

async function resolveOwnerId(supabase: SupabaseClient<Database>): Promise<string> {
  const ownerId = process.env.OWNER_USER_ID?.trim();
  if (ownerId) {
    return ownerId;
  }

  const ownerEmail = process.env.OWNER_EMAIL?.trim();
  if (ownerEmail) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === ownerEmail.toLowerCase());
    if (match?.id) {
      return match.id;
    }

    throw new Error(`OWNER_EMAIL not found in auth users: ${ownerEmail}`);
  }

  throw new Error('Set OWNER_USER_ID or OWNER_EMAIL before seeding a restaurant.');
}

async function main(): Promise<void> {
  assertSeedRestaurantSafety();

  const [
    { createRestaurant },
    { createRestaurantSchema },
    { getServiceSupabaseClient, resolveServiceRoleSupabaseUrl },
  ] = await Promise.all([
    import('../server/restaurants/create'),
    import('../src/app/api/ops/restaurants/schema'),
    import('../server/supabase'),
  ]);

  assertStagingScriptSafety({
    apiUrl: resolveServiceRoleSupabaseUrl(),
    expectedProjectRef: process.env.EXPECTED_STAGING_PROJECT_REF ?? DEFAULT_STAGING_PROJECT_REF,
    targetEnv: process.env.DB_TARGET_ENV ?? process.env.APP_ENV,
    confirmation: process.env.CONFIRM_STAGING_RESTAURANT_SEED,
    confirmationName: 'CONFIRM_STAGING_RESTAURANT_SEED',
  });

  const supabase = getServiceSupabaseClient();
  const ownerId = await resolveOwnerId(supabase);

  const seedInput = buildSeedInput();
  const validated = createRestaurantSchema.parse(seedInput);

  const restaurant = await createRestaurant(validated, ownerId, supabase);

  console.log('Seeded restaurant:');
  console.log({
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    ownerId,
  });
}

void main().catch((error) => {
  console.error('[seed-restaurant] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
