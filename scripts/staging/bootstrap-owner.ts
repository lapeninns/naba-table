import { config as loadEnv } from 'dotenv';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import { DEFAULT_STAGING_PROJECT_REF, assertStagingScriptSafety } from '../db/safety';
import type { Database } from '@/types/supabase';

type RestaurantRole = 'owner' | 'manager' | 'host' | 'server';

function readEnvFromRepoRoot() {
  const modulePath = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(modulePath), '../..');
  const envLocalPath = path.join(repoRoot, '.env.local');

  if (fs.existsSync(envLocalPath)) {
    loadEnv({ path: envLocalPath, override: false });
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function normalizeRole(value: string | undefined): RestaurantRole {
  const raw = (value ?? 'owner').trim().toLowerCase();
  if (raw === 'owner' || raw === 'manager' || raw === 'host' || raw === 'server') {
    return raw;
  }
  throw new Error(`Invalid role "${value}". Expected one of: owner, manager, host, server.`);
}

function generatePassword(): string {
  // 20+ chars, URL-safe, not printed unless caller prints it.
  return crypto.randomBytes(24).toString('base64url');
}

function sanitizeFilename(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function writePasswordToGitignoredBackups(
  repoRoot: string,
  email: string,
  password: string,
): string {
  const timestamp = new Date().toISOString().replace(/[:-]/g, '').slice(0, 15); // YYYYMMDDTHHMMSS
  const safeEmail = sanitizeFilename(email);
  const outPath =
    (process.env.BOOTSTRAP_PASSWORD_OUT ?? '').trim() ||
    path.join(repoRoot, 'backups', `staging-bootstrap-${safeEmail}-${timestamp}.txt`);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  // Ensure restrictive permissions even if user's umask is permissive.
  fs.writeFileSync(outPath, `${password}\n`, { encoding: 'utf-8', mode: 0o600 });
  return outPath;
}

async function main() {
  readEnvFromRepoRoot();

  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  assertStagingScriptSafety({
    apiUrl: supabaseUrl,
    expectedProjectRef: process.env.EXPECTED_STAGING_PROJECT_REF ?? DEFAULT_STAGING_PROJECT_REF,
    targetEnv: process.env.DB_TARGET_ENV ?? process.env.APP_ENV,
    confirmation: process.env.CONFIRM_STAGING_OWNER_BOOTSTRAP,
    confirmationName: 'CONFIRM_STAGING_OWNER_BOOTSTRAP',
  });

  const email = requireEnv('BOOTSTRAP_OWNER_EMAIL');
  const name = (process.env.BOOTSTRAP_OWNER_NAME ?? '').trim() || null;
  const role = normalizeRole(process.env.BOOTSTRAP_OWNER_ROLE);
  const explicitPassword = (process.env.BOOTSTRAP_OWNER_PASSWORD ?? '').trim();
  const generatedPassword = explicitPassword ? null : generatePassword();
  const password = explicitPassword || generatedPassword || '';
  if (!password) throw new Error('Failed to resolve password.');

  const modulePath = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(modulePath), '../..');

  let passwordOutPath: string | null = null;
  if (generatedPassword) {
    // If we generated a password, store it in a gitignored location so it can be retrieved
    // without printing to logs/chat.
    passwordOutPath = writePasswordToGitignoredBackups(repoRoot, email, password);
  }

  // Use service role for admin actions and seeding.
  const service = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create (or reuse) auth user.
  let userId: string;
  let createdNewUser = false;
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: name ? { name } : {},
  });

  if (created.error) {
    // If the user exists, attempt to find them.
    const msg = created.error.message ?? 'Unknown error';
    if (!/already|exists|duplicate/i.test(msg)) {
      throw created.error;
    }

    const listed = await service.auth.admin.listUsers({ perPage: 1000, page: 1 });
    if (listed.error) {
      throw listed.error;
    }
    const existing = (listed.data?.users ?? []).find(
      (u) => (u.email ?? '').toLowerCase() === email.toLowerCase(),
    );
    if (!existing?.id) {
      throw new Error(
        `User appears to exist but could not be found by listUsers(). Original error: ${msg}`,
      );
    }
    userId = existing.id;
  } else {
    createdNewUser = true;
    userId = created.data.user?.id ?? '';
    if (!userId) {
      throw new Error('User created but no user id returned.');
    }
  }

  // Ensure the account is usable with the selected password even if it already existed.
  if (!createdNewUser) {
    const updated = await service.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: name ? { name } : {},
    });
    if (updated.error) {
      throw updated.error;
    }
  }

  // Ensure public profile rows exist (some code uses profiles, some uses user_profiles).
  const profileUpsert = await service
    .from('profiles')
    .upsert(
      {
        id: userId,
        email,
        name,
        has_access: true,
      },
      { onConflict: 'id' },
    )
    .select('id')
    .maybeSingle();

  if (profileUpsert.error) {
    throw profileUpsert.error;
  }

  const userProfileUpsert = await service
    .from('user_profiles')
    .upsert(
      {
        id: userId,
        name,
        marketing_opt_in: false,
        // Keep this false so test emails can be observed if desired; suppression should be enforced by app/env.
        is_email_suppressed: false,
      },
      { onConflict: 'id' },
    )
    .select('id')
    .maybeSingle();

  if (userProfileUpsert.error) {
    throw userProfileUpsert.error;
  }

  // Grant access to all restaurants in this staging project.
  const restaurantsRes = await service
    .from('restaurants')
    .select('id, name, slug')
    .order('name', { ascending: true });
  if (restaurantsRes.error) {
    throw restaurantsRes.error;
  }
  const restaurants = restaurantsRes.data ?? [];
  if (restaurants.length === 0) {
    throw new Error('No restaurants found. Seed restaurants before bootstrapping an owner.');
  }

  const membershipRows = restaurants.map((r) => ({
    user_id: userId,
    restaurant_id: r.id,
    role,
  }));

  const membershipInsert = await service.from('restaurant_memberships').upsert(membershipRows, {
    onConflict: 'user_id,restaurant_id',
  });

  if (membershipInsert.error) {
    throw membershipInsert.error;
  }

  // Basic auth sanity check using anon key (does password sign-in work).
  const publicClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await publicClient.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    console.warn(
      '[bootstrap-owner] User created and memberships granted, but password sign-in failed. Check Supabase Auth settings.',
      { message: signIn.error.message },
    );
  }

  // RLS sanity check: authed user should be able to see their restaurant list.
  if (signIn.data.session) {
    const userClient = createClient<Database>(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const setSession = await userClient.auth.setSession(signIn.data.session);
    if (setSession.error) {
      console.warn('[bootstrap-owner] Session set failed; skipping RLS smoke check.', {
        message: setSession.error.message,
      });
    } else {
      const rlsRestaurants = await userClient
        .from('restaurants')
        .select('id, restaurant_memberships!inner(role)')
        .eq('restaurant_memberships.user_id', userId);
      if (rlsRestaurants.error) {
        console.warn('[bootstrap-owner] RLS restaurant list check failed.', {
          message: rlsRestaurants.error.message,
        });
      } else if ((rlsRestaurants.data ?? []).length === 0) {
        console.warn(
          '[bootstrap-owner] RLS restaurant list returned 0 rows; verify RLS policies/memberships.',
        );
      }
    }
  }

  console.log('[bootstrap-owner] Bootstrapped owner access in staging.');
  console.log(`- Supabase URL: ${supabaseUrl}`);
  console.log(`- User: ${email}`);
  console.log(`- User ID: ${userId}`);
  console.log(`- Role: ${role}`);
  console.log(`- Restaurants granted: ${restaurants.length}`);

  // Intentionally print password only when caller opts in (avoid leaking into logs by default).
  if (process.env.BOOTSTRAP_PRINT_PASSWORD === '1') {
    console.log(`- Password: ${password}`);
  } else {
    if (passwordOutPath) {
      console.log(`- Password: (not printed; written to ${passwordOutPath})`);
    } else {
      console.log('- Password: (not printed; provided via BOOTSTRAP_OWNER_PASSWORD)');
    }
  }
}

main().catch((error) => {
  console.error('[bootstrap-owner] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
