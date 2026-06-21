import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient, type User } from '@supabase/supabase-js';

import {
  DEFAULT_PRODUCTION_PROJECT_REF,
  DEFAULT_STAGING_PROJECT_REF,
  assertProductionApiScriptSafety,
  assertStagingScriptSafety,
} from './db/safety';
import type { Database } from '../types/supabase';

type RestaurantRole = 'owner' | 'manager' | 'host' | 'server';

const modulePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(modulePath), '..');

const apply = process.env.APPLY === 'true' || process.argv.includes('--apply');
const targetEnv = (process.env.DB_TARGET_ENV ?? process.env.APP_ENV ?? '').trim().toLowerCase();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const expectedProjectRef =
  process.env.EXPECTED_PROJECT_REF?.trim() ||
  (targetEnv === 'production' ? DEFAULT_PRODUCTION_PROJECT_REF : DEFAULT_STAGING_PROJECT_REF);

const restaurantSlug = requireInput('RESTAURANT_SLUG');
const ownerEmail = requireInput('OWNER_EMAIL').toLowerCase();
const ownerName = (process.env.OWNER_NAME ?? '').trim() || null;
const role = normalizeRole(process.env.OWNER_ROLE);
const authUserIdOverride = (process.env.AUTH_USER_ID ?? '').trim() || null;
const resetExistingPassword = process.env.RESET_EXISTING_PASSWORD === 'true';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
}
const checkedSupabaseUrl = supabaseUrl;
const checkedServiceRoleKey = serviceRoleKey;

assertSafety();

const supabase = createClient<Database>(checkedSupabaseUrl, checkedServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function requireInput(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function normalizeRole(value: string | undefined): RestaurantRole {
  const normalized = (value ?? 'owner').trim().toLowerCase();
  if (
    normalized === 'owner' ||
    normalized === 'manager' ||
    normalized === 'host' ||
    normalized === 'server'
  ) {
    return normalized;
  }
  throw new Error(`OWNER_ROLE must be one of owner, manager, host, server; received ${value}.`);
}

function assertSafety(): void {
  if (targetEnv === 'production') {
    assertProductionApiScriptSafety({
      apiUrl: checkedSupabaseUrl,
      expectedProjectRef,
      targetEnv,
      requireTargetEnv: true,
      apply,
      confirmation: process.env.CONFIRM_PRODUCTION_AUTH_BOOTSTRAP,
      confirmationName: 'CONFIRM_PRODUCTION_AUTH_BOOTSTRAP',
    });
    return;
  }

  assertStagingScriptSafety({
    apiUrl: checkedSupabaseUrl,
    expectedProjectRef,
    targetEnv,
    confirmation: process.env.CONFIRM_STAGING_AUTH_BOOTSTRAP,
    confirmationName: 'CONFIRM_STAGING_AUTH_BOOTSTRAP',
  });
}

function generatePassword(): string {
  return randomBytes(24).toString('base64url');
}

function sanitizeFilename(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function writePasswordBackup(password: string): string {
  const timestamp = new Date().toISOString().replace(/[:-]/g, '').slice(0, 15);
  const outPath = path.join(
    repoRoot,
    'backups',
    `auth-bootstrap-${targetEnv}-${sanitizeFilename(ownerEmail)}-${timestamp}.txt`,
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `email=${ownerEmail}\npassword=${password}\n`, {
    encoding: 'utf-8',
    mode: 0o600,
  });
  return outPath;
}

async function resolveRestaurant(): Promise<{
  id: string;
  name: string | null;
  slug: string | null;
}> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id,name,slug')
    .eq('slug', restaurantSlug)
    .maybeSingle();

  if (error) throw new Error(`Failed to read restaurant: ${error.message}`);
  if (!data) throw new Error(`Restaurant not found for slug: ${restaurantSlug}`);
  return data;
}

async function loadUserFromProfile(): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email')
    .eq('email', ownerEmail)
    .maybeSingle();

  if (error) throw new Error(`Failed to read profiles: ${error.message}`);
  if (!data?.id) return null;

  const lookup = await supabase.auth.admin.getUserById(data.id);
  if (lookup.error || !lookup.data.user) {
    throw new Error(`Failed to load auth user from profile id: ${lookup.error?.message}`);
  }
  return lookup.data.user;
}

async function ensureAuthUser(): Promise<{
  user: User;
  created: boolean;
  password: string | null;
  passwordOutPath: string | null;
}> {
  if (authUserIdOverride) {
    const lookup = await supabase.auth.admin.getUserById(authUserIdOverride);
    if (lookup.error || !lookup.data.user) {
      throw new Error(`Failed to load AUTH_USER_ID: ${lookup.error?.message}`);
    }

    if (!resetExistingPassword) {
      return { user: lookup.data.user, created: false, password: null, passwordOutPath: null };
    }

    const password = generatePassword();
    const updated = await supabase.auth.admin.updateUserById(lookup.data.user.id, {
      password,
      email_confirm: true,
      user_metadata: ownerName ? { name: ownerName } : {},
    });
    if (updated.error || !updated.data.user) {
      throw new Error(`Failed to reset AUTH_USER_ID password: ${updated.error?.message}`);
    }
    return {
      user: updated.data.user,
      created: false,
      password,
      passwordOutPath: writePasswordBackup(password),
    };
  }

  const existing = await loadUserFromProfile();
  if (existing) {
    if (!resetExistingPassword) {
      return { user: existing, created: false, password: null, passwordOutPath: null };
    }

    const password = generatePassword();
    const updated = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: ownerName ? { name: ownerName } : {},
    });
    if (updated.error || !updated.data.user) {
      throw new Error(`Failed to reset existing password: ${updated.error?.message}`);
    }
    return {
      user: updated.data.user,
      created: false,
      password,
      passwordOutPath: writePasswordBackup(password),
    };
  }

  const password = generatePassword();
  const created = await supabase.auth.admin.createUser({
    email: ownerEmail,
    password,
    email_confirm: true,
    user_metadata: ownerName ? { name: ownerName } : {},
  });

  if (created.error || !created.data.user) {
    throw new Error(
      `Failed to create auth user: ${created.error?.message ?? 'unknown error'}. If the auth user already exists without a profile row, rerun with AUTH_USER_ID set.`,
    );
  }

  return {
    user: created.data.user,
    created: true,
    password,
    passwordOutPath: writePasswordBackup(password),
  };
}

async function upsertProfileRows(user: User): Promise<void> {
  const profile = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? ownerEmail,
      name: ownerName,
      has_access: true,
    },
    { onConflict: 'id' },
  );
  if (profile.error) throw new Error(`Failed to upsert profile: ${profile.error.message}`);

  const userProfile = await supabase.from('user_profiles').upsert(
    {
      id: user.id,
      name: ownerName,
      marketing_opt_in: false,
      is_email_suppressed: false,
    },
    { onConflict: 'id' },
  );
  if (userProfile.error) {
    throw new Error(`Failed to upsert user_profile: ${userProfile.error.message}`);
  }
}

async function upsertMembership(userId: string, restaurantId: string): Promise<void> {
  const { error } = await supabase.from('restaurant_memberships').upsert(
    {
      user_id: userId,
      restaurant_id: restaurantId,
      role,
    },
    { onConflict: 'user_id,restaurant_id' },
  );

  if (error) throw new Error(`Failed to upsert membership: ${error.message}`);
}

async function verifyPasswordSignIn(password: string | null): Promise<boolean | null> {
  if (!password || !anonKey) return null;

  const publicClient = createClient<Database>(checkedSupabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await publicClient.auth.signInWithPassword({ email: ownerEmail, password });
  return !signIn.error && Boolean(signIn.data.session);
}

async function readState(restaurantId: string, userId: string | null) {
  const { data: memberships, error: membershipsError } = await supabase
    .from('restaurant_memberships')
    .select('user_id,role')
    .eq('restaurant_id', restaurantId);
  if (membershipsError) throw new Error(`Failed to read memberships: ${membershipsError.message}`);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,email,name,has_access')
    .eq('email', ownerEmail)
    .maybeSingle();
  if (profileError) throw new Error(`Failed to read profile: ${profileError.message}`);

  const selectedMembership = userId
    ? (memberships ?? []).find((membership) => membership.user_id === userId)
    : null;

  return {
    profile: profile ?? null,
    membership: selectedMembership ?? null,
    restaurantMembershipCount: memberships?.length ?? 0,
  };
}

async function main(): Promise<void> {
  const restaurant = await resolveRestaurant();
  const existing = await loadUserFromProfile();
  const before = await readState(restaurant.id, existing?.id ?? null);

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          apply,
          targetEnv,
          restaurant,
          ownerEmail,
          ownerName,
          role,
          before,
          wouldCreateAuthUser: !existing && !authUserIdOverride,
          wouldResetExistingPassword: Boolean(
            (existing || authUserIdOverride) && resetExistingPassword,
          ),
        },
        null,
        2,
      ),
    );
    return;
  }

  const ensured = await ensureAuthUser();
  await upsertProfileRows(ensured.user);
  await upsertMembership(ensured.user.id, restaurant.id);
  const after = await readState(restaurant.id, ensured.user.id);
  const passwordSignInOk = await verifyPasswordSignIn(ensured.password);

  console.log(
    JSON.stringify(
      {
        ok: true,
        targetEnv,
        restaurant,
        ownerEmail,
        role,
        userId: ensured.user.id,
        createdAuthUser: ensured.created,
        password: ensured.passwordOutPath
          ? { printed: false, backupPath: ensured.passwordOutPath }
          : { printed: false, backupPath: null },
        passwordSignInOk,
        before,
        after,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(
    '[bootstrap-restaurant-owner] Failed:',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
