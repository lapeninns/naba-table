import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import {
  assertExactSupabaseApiProjectRef,
  assertProductionApiScriptSafety,
  assertStagingScriptSafety,
} from './db/safety';

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '..');
const envLocalPath = path.join(projectRoot, '.env.local');

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const confirmProduction = process.env.CONFIRM_PRODUCTION === 'true';
const confirmStagingWrite = process.env.CONFIRM_STAGING_WRITE === 'true';
const expectedProjectRef = process.env.EXPECTED_PROJECT_REF?.trim() || null;
const apply = process.argv.includes('--apply') || process.env.APPLY === 'true';

const restaurantSlug = process.env.RESTAURANT_SLUG?.trim() || 'the-railway-pub';
const updateJson = process.env.UPDATE_JSON?.trim();

const defaultValues = {
  name: 'The Railway',
  address: '139 Station Road, Whittlesey, PE7 1UF',
  contact_phone: '01733 788345',
  google_review_url:
    'https://search.google.com/local/writereview?placeid=ChIJn09BgED7d0gRjUmOuzWq6wI',
  google_map_url: 'https://maps.google.com/?q=139%20Station%20Road%2C%20Whittlesey%2C%20PE7%201UF',
};

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

if (!expectedProjectRef) {
  console.error('EXPECTED_PROJECT_REF is required before using the service-role key.');
  process.exit(1);
}

try {
  const targetEnv =
    process.env.DB_TARGET_ENV?.trim().toLowerCase() ||
    process.env.APP_ENV?.trim().toLowerCase() ||
    '';

  if (targetEnv === 'production') {
    assertProductionApiScriptSafety({
      apiUrl: supabaseUrl,
      expectedProjectRef,
      targetEnv,
      requireTargetEnv: true,
      apply,
      confirmation: confirmProduction ? 'true' : undefined,
    });
  } else if (targetEnv === 'staging') {
    if (apply) {
      assertStagingScriptSafety({
        apiUrl: supabaseUrl,
        expectedProjectRef,
        targetEnv,
        confirmation: confirmStagingWrite ? 'true' : undefined,
      });
    } else {
      assertExactSupabaseApiProjectRef(supabaseUrl, expectedProjectRef);
    }
  } else {
    throw new Error(`Unsupported DB_TARGET_ENV/APP_ENV for restaurant update: ${targetEnv}.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Production safety validation failed.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type RestaurantUpdate = Partial<{
  name: string;
  address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  google_map_url: string | null;
  google_review_url: string | null;
  booking_policy: string | null;
  logo_url: string | null;
}>;

function buildUpdatePayload(): RestaurantUpdate {
  if (!updateJson) {
    return defaultValues;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(updateJson);
  } catch {
    throw new Error('UPDATE_JSON must be valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('UPDATE_JSON must be a JSON object.');
  }

  const allowedKeys = new Set([
    'name',
    'address',
    'contact_phone',
    'contact_email',
    'google_map_url',
    'google_review_url',
    'booking_policy',
    'logo_url',
  ]);

  const payload: RestaurantUpdate = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`UPDATE_JSON contains unsupported key: ${key}`);
    }
    (payload as Record<string, unknown>)[key] = value;
  }

  return payload;
}

async function main(): Promise<void> {
  const updatedValues = buildUpdatePayload();

  if (!apply) {
    console.log('Dry run. Set APPLY=true or pass --apply to update restaurant details.');
    console.log({ restaurantSlug, updatedValues });
    return;
  }

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .update(updatedValues)
    .eq('slug', restaurantSlug)
    .select(
      'id, name, slug, address, contact_email, contact_phone, google_map_url, google_review_url',
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update restaurant: ${error.message}`);
  }

  if (!restaurant) {
    throw new Error(`Restaurant not found for slug: ${restaurantSlug}`);
  }

  console.log('Restaurant updated:');
  console.log(restaurant);
}

void main().catch((error) => {
  console.error('[update-railway-details] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
