import { config as loadEnv } from "dotenv";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

import type { Database } from "@/types/supabase";
import type { User } from "@supabase/supabase-js";

type RestaurantRole = "owner" | "manager" | "host" | "server";

type MembershipRow = {
  restaurant_id: string;
  role: RestaurantRole;
  restaurants?: { name: string | null; slug: string | null } | { name: string | null; slug: string | null }[] | null;
};

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "..");
const defaultEnvPath = path.join(projectRoot, ".env.vercel-production.live");

if (fs.existsSync(defaultEnvPath)) {
  loadEnv({ path: defaultEnvPath, override: false });
}

const apply = process.env.APPLY === "true";
const confirmProduction = process.env.CONFIRM_PRODUCTION === "true";
const expectedProjectRef = process.env.EXPECTED_PROJECT_REF?.trim() || "vrdiqfudmwydclqpydee";

const restaurantId = process.env.RESTAURANT_ID?.trim() || "a120da71-ba6d-446f-a33a-2e78787abcb0";
const userEmail = process.env.USER_EMAIL?.trim().toLowerCase() || "oldschoolhouse@lapeninns.com";
const role = normalizeRole(process.env.ROLE);

const supabaseUrl = process.env.PRODUCTION_SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey =
  process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const dbUrl = process.env.PRODUCTION_SUPABASE_DB_URL?.trim() || process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing production Supabase URL or service role key.");
  process.exit(1);
}

if (!supabaseUrl.includes(expectedProjectRef)) {
  console.error(`Supabase URL does not match expected project ref (${expectedProjectRef}).`);
  process.exit(1);
}

if (apply && !confirmProduction) {
  console.error("CONFIRM_PRODUCTION=true is required to modify production data.");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function normalizeRole(value: string | undefined): RestaurantRole {
  const raw = (value ?? "manager").trim().toLowerCase();
  if (raw === "owner" || raw === "manager" || raw === "host" || raw === "server") {
    return raw;
  }
  throw new Error(`Invalid role: ${value}`);
}

function generatePassword(): string {
  return crypto.randomBytes(24).toString("base64url");
}

async function resolveUserIdFromProfiles(email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to query profiles: ${error.message}`);
  }

  return data?.id ?? null;
}

async function resolveUserIdFromAdmin(email: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) {
      console.warn("[grant-production-restaurant-access] listUsers fallback unavailable:", error.message);
      return null;
    }
    const match = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    return match?.id ?? null;
  } catch (error) {
    console.warn(
      "[grant-production-restaurant-access] listUsers threw; falling back to DB lookup.",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

async function resolveUserIdFromDb(email: string): Promise<string | null> {
  if (!dbUrl) {
    return null;
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query("select id from auth.users where lower(email) = $1 limit 1", [email]);
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0]?.id ?? null;
  } catch (error) {
    console.warn(
      "[grant-production-restaurant-access] DB auth lookup unavailable:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  } finally {
    await client.end();
  }
}

async function resolveUserFromGeneratedMagicLink(email: string): Promise<User | null> {
  try {
    const result = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (result.error) {
      console.warn(
        "[grant-production-restaurant-access] generateLink fallback unavailable:",
        result.error.message,
      );
      return null;
    }

    return result.data.user ?? null;
  } catch (error) {
    console.warn(
      "[grant-production-restaurant-access] generateLink threw:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

async function ensureAuthUser(email: string): Promise<{ user: User; created: boolean }> {
  const fromProfiles = await resolveUserIdFromProfiles(email);
  if (fromProfiles) {
    const lookup = await supabase.auth.admin.getUserById(fromProfiles);
    if (lookup.error || !lookup.data.user) {
      throw new Error(`Failed to load auth user by profile id: ${lookup.error?.message ?? "missing user"}`);
    }
    return { user: lookup.data.user, created: false };
  }

  const fromAdmin = await resolveUserIdFromAdmin(email);
  if (fromAdmin) {
    const lookup = await supabase.auth.admin.getUserById(fromAdmin);
    if (lookup.error || !lookup.data.user) {
      throw new Error(`Failed to load auth user by admin id: ${lookup.error?.message ?? "missing user"}`);
    }
    return { user: lookup.data.user, created: false };
  }

  const fromDb = await resolveUserIdFromDb(email);
  if (fromDb) {
    const lookup = await supabase.auth.admin.getUserById(fromDb);
    if (lookup.error || !lookup.data.user) {
      throw new Error(`Failed to load auth user by db id: ${lookup.error?.message ?? "missing user"}`);
    }
    return { user: lookup.data.user, created: false };
  }

  const fromMagicLink = await resolveUserFromGeneratedMagicLink(email);
  if (fromMagicLink) {
    return { user: fromMagicLink, created: false };
  }

  const created = await supabase.auth.admin.createUser({
    email,
    password: generatePassword(),
    email_confirm: true,
    user_metadata: { name: "Old School House" },
  });

  if (created.error || !created.data.user) {
    throw new Error(`Failed to create auth user: ${created.error?.message ?? "unknown error"}`);
  }

  return { user: created.data.user, created: true };
}

async function loadMemberships(userId: string): Promise<MembershipRow[]> {
  const { data, error } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id,role,restaurants(name,slug)")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to read memberships: ${error.message}`);
  }

  return (data ?? []) as MembershipRow[];
}

async function upsertMembership(userId: string): Promise<void> {
  const { error } = await supabase.from("restaurant_memberships").upsert(
    {
      user_id: userId,
      restaurant_id: restaurantId,
      role,
    },
    { onConflict: "user_id,restaurant_id" },
  );

  if (error) {
    throw new Error(`Failed to upsert membership: ${error.message}`);
  }
}

async function ensureProfileRows(user: User): Promise<void> {
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? userEmail,
        name:
          typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : "Old School House",
        has_access: true,
      },
      { onConflict: "id" },
    );

  if (profileError) {
    throw new Error(`Failed to upsert profile row: ${profileError.message}`);
  }

  const { error: userProfileError } = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: user.id,
        name:
          typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : "Old School House",
        marketing_opt_in: false,
        is_email_suppressed: false,
      },
      { onConflict: "id" },
    );

  if (userProfileError && !/does not exist/i.test(userProfileError.message)) {
    throw new Error(`Failed to upsert user_profiles row: ${userProfileError.message}`);
  }
}

async function main(): Promise<void> {
  const { user, created } = await ensureAuthUser(userEmail);
  const beforeMemberships = await loadMemberships(user.id);

  const before = {
    userId: user.id,
    email: user.email ?? userEmail,
    created,
    memberships: beforeMemberships,
  };

  console.log(JSON.stringify({ apply, restaurantId, role, before }, null, 2));

  if (!apply) {
    return;
  }

  await ensureProfileRows(user);
  await upsertMembership(user.id);

  const afterMemberships = await loadMemberships(user.id);

  console.log(
    JSON.stringify(
      {
        ok: true,
        restaurantId,
        role,
        userId: user.id,
        email: user.email ?? userEmail,
        created,
        memberships: afterMemberships,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(
    "[grant-production-restaurant-access] Failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
