import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import { assertExactSupabaseApiProjectRef } from './db/safety';
import {
  isRestaurantRole,
  RESTAURANT_ROLE_OPTIONS,
  type RestaurantRole,
} from '../lib/owner/auth/roles';

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '..');
const envLocalPath = path.join(projectRoot, '.env.local');

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const confirmProduction = process.env.CONFIRM_PRODUCTION === 'true';
const expectedProjectRef = process.env.EXPECTED_PROJECT_REF?.trim() || null;
const restaurantId = process.env.RESTAURANT_ID?.trim() || null;
const restaurantSlug = process.env.RESTAURANT_SLUG?.trim() || null;
const userEmail = process.env.USER_EMAIL?.trim() || null;
const userId = process.env.USER_ID?.trim() || null;
const role = normalizeRole(process.env.ROLE);

function normalizeRole(value: string | undefined): RestaurantRole {
  const candidate = (value?.trim() || 'owner').toLowerCase();
  if (isRestaurantRole(candidate)) {
    return candidate;
  }

  console.error(`ROLE must be one of: ${RESTAURANT_ROLE_OPTIONS.join(', ')}.`);
  process.exit(1);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

if (!confirmProduction) {
  console.error('CONFIRM_PRODUCTION=true is required to modify production data.');
  process.exit(1);
}

if (!expectedProjectRef) {
  console.error('EXPECTED_PROJECT_REF is required before using the service-role key.');
  process.exit(1);
}

try {
  assertExactSupabaseApiProjectRef(supabaseUrl, expectedProjectRef);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Supabase URL validation failed.');
  process.exit(1);
}
if (!restaurantId && !restaurantSlug) {
  console.error('Set RESTAURANT_ID or RESTAURANT_SLUG.');
  process.exit(1);
}

if (!userId && !userEmail) {
  console.error('Set USER_ID or USER_EMAIL.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function resolveRestaurantId(): Promise<string> {
  if (restaurantId) return restaurantId;

  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, slug')
    .eq('slug', restaurantSlug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve restaurant: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Restaurant not found for slug: ${restaurantSlug}`);
  }

  return data.id;
}

async function resolveUserId(): Promise<string> {
  if (userId) return userId;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', userEmail)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to query profiles: ${profileError.message}`);
  }

  if (profile?.id) {
    return profile.id;
  }

  const { data: userProfile, error: userProfileError } = await supabase
    .from('user_profiles')
    .select('id, email')
    .eq('email', userEmail)
    .maybeSingle();

  if (userProfileError) {
    if (!/does not exist/i.test(userProfileError.message)) {
      throw new Error(`Failed to query user_profiles: ${userProfileError.message}`);
    }
  }

  if (userProfile?.id) {
    return userProfile.id;
  }

  const pageSize = 200;
  const maxPages = 20;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: pageSize });
    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}. Provide USER_ID to continue.`);
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === userEmail?.toLowerCase());
    if (match?.id) {
      return match.id;
    }

    if (data.users.length < pageSize) {
      break;
    }
  }

  throw new Error(`User not found for email: ${userEmail}`);
}

async function grantAccess(): Promise<void> {
  const resolvedRestaurantId = await resolveRestaurantId();
  const resolvedUserId = await resolveUserId();

  const { data: existing, error: existingError } = await supabase
    .from('restaurant_memberships')
    .select('role')
    .eq('restaurant_id', resolvedRestaurantId)
    .eq('user_id', resolvedUserId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to read memberships: ${existingError.message}`);
  }

  if (existing) {
    if (!isRestaurantRole(existing.role)) {
      throw new Error(
        `Existing membership has unsupported role "${existing.role}". Clean it up before granting access.`,
      );
    }

    if (existing.role === role) {
      console.log('Membership already exists with desired role.');
      return;
    }

    const { error: updateError } = await supabase
      .from('restaurant_memberships')
      .update({ role })
      .eq('restaurant_id', resolvedRestaurantId)
      .eq('user_id', resolvedUserId);

    if (updateError) {
      throw new Error(`Failed to update membership: ${updateError.message}`);
    }

    console.log('Membership role updated.');
    return;
  }

  const { error: insertError } = await supabase.from('restaurant_memberships').insert({
    restaurant_id: resolvedRestaurantId,
    user_id: resolvedUserId,
    role,
  });

  if (insertError) {
    throw new Error(`Failed to insert membership: ${insertError.message}`);
  }

  console.log('Membership created.');
}

void grantAccess().catch((error) => {
  console.error(
    '[grant-restaurant-access] Failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
