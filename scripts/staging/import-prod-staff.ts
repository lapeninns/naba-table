import { config as loadEnv, parse as parseEnv } from "dotenv";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

type RestaurantRole = "owner" | "manager" | "host" | "server";

type ProdMembershipRow = {
  email: string;
  name: string | null;
  role: RestaurantRole;
  restaurant_id: string;
  restaurant_slug: string | null;
  restaurant_name: string | null;
};

type StagingUser = {
  email: string;
  name: string | null;
  userId: string;
  password: string;
  roles: Set<RestaurantRole>;
  restaurantIds: Set<string>;
};

function readRepoEnvFiles() {
  const modulePath = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(modulePath), "../..");

  const envLocalPath = path.join(repoRoot, ".env.local");
  const envProdPath = path.join(repoRoot, ".env.vercel-production");

  if (fs.existsSync(envLocalPath)) {
    loadEnv({ path: envLocalPath, override: false });
  }

  return { repoRoot, envLocalPath, envProdPath };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseSupabaseProjectRefFromUrl(url: string): string {
  const raw = url.trim().replace(/"/g, "");
  const match = raw.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  if (!match) {
    throw new Error(`Unable to parse Supabase project ref from url: ${url}`);
  }
  return match[1]!.toLowerCase();
}

function normalizeRole(value: unknown): RestaurantRole | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  if (raw === "owner" || raw === "manager" || raw === "host" || raw === "server") {
    return raw;
  }
  return null;
}

function generatePassword(): string {
  return crypto.randomBytes(18).toString("base64url"); // ~24 chars
}

function parseRoleAllowlist(): Set<RestaurantRole> {
  // Default: only import roles that can administer restaurants.
  const raw = (process.env.IMPORT_ROLES ?? "owner,manager").trim();
  const values = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const roles = new Set<RestaurantRole>();
  for (const v of values) {
    const role = normalizeRole(v);
    if (!role) {
      throw new Error(`Invalid IMPORT_ROLES entry "${v}". Expected one of: owner,manager,host,server`);
    }
    roles.add(role);
  }
  return roles;
}

async function loadProdMemberships(params: {
  prodRef: string;
  prodDbPassword: string;
}): Promise<ProdMembershipRow[]> {
  const { prodRef, prodDbPassword } = params;
  const connectionString = `postgresql://postgres:${encodeURIComponent(prodDbPassword)}@db.${prodRef}.supabase.co:5432/postgres`;

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const result = await client.query(
      `
      select
        u.email as email,
        p.name as name,
        rm.role as role,
        rm.restaurant_id::text as restaurant_id,
        r.slug as restaurant_slug,
        r.name as restaurant_name
      from public.restaurant_memberships rm
      join public.restaurants r on r.id = rm.restaurant_id
      join auth.users u on u.id = rm.user_id
      left join public.profiles p on p.id = rm.user_id
      where u.email is not null
      `,
    );

    return (result.rows ?? [])
      .map((row) => {
        const role = normalizeRole(row.role);
        return {
          email: String(row.email ?? "").trim(),
          name: row.name ? String(row.name) : null,
          role: role ?? "host",
          restaurant_id: String(row.restaurant_id ?? "").trim(),
          restaurant_slug: row.restaurant_slug ? String(row.restaurant_slug) : null,
          restaurant_name: row.restaurant_name ? String(row.restaurant_name) : null,
        } satisfies ProdMembershipRow;
      })
      .filter((row) => row.email.length > 0 && row.restaurant_id.length > 0);
  } finally {
    await client.end().catch(() => {});
  }
}

async function ensureStagingUser(params: {
  staging: ReturnType<typeof createClient<Database>>;
  email: string;
  name: string | null;
  password: string;
}): Promise<string> {
  const { staging, email, name, password } = params;

  const created = await staging.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: name ? { name } : {},
  });

  if (!created.error) {
    const id = created.data.user?.id ?? "";
    if (!id) throw new Error(`User created for ${email}, but no id returned.`);
    return id;
  }

  // If already exists, find it.
  const msg = created.error.message ?? "Unknown error";
  if (!/already|exists|duplicate/i.test(msg)) {
    throw created.error;
  }

  const listed = await staging.auth.admin.listUsers({ perPage: 1000, page: 1 });
  if (listed.error) throw listed.error;
  const existing = (listed.data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  if (!existing?.id) {
    throw new Error(`User exists but could not be resolved by listUsers: ${email}`);
  }

  // Ensure the generated password is actually valid for staging logins.
  const updated = await staging.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: name ? { name } : {},
  });
  if (updated.error) throw updated.error;

  return existing.id;
}

async function main() {
  const { repoRoot, envProdPath } = readRepoEnvFiles();
  const allowRoles = parseRoleAllowlist();

  const stagingUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const stagingServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!fs.existsSync(envProdPath)) {
    throw new Error(`Missing ${envProdPath}. This script needs production DB access to read staff memberships.`);
  }

  // Load prod connection details from .env.vercel-production without mutating process.env staging values.
  const prodEnv = parseEnv(fs.readFileSync(envProdPath));
  const prodUrl = (prodEnv.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/"/g, "");
  const prodDbPassword = (prodEnv.SUPABASE_DB_PASSWORD ?? "").trim();
  if (!prodUrl || !prodDbPassword) {
    throw new Error(`.env.vercel-production must include NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD`);
  }

  const prodRef = parseSupabaseProjectRefFromUrl(prodUrl);

  const staging = createClient<Database>(stagingUrl, stagingServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const stagingRestaurantsRes = await staging.from("restaurants").select("id");
  if (stagingRestaurantsRes.error) {
    throw stagingRestaurantsRes.error;
  }
  const stagingRestaurantIds = new Set((stagingRestaurantsRes.data ?? []).map((row) => row.id));
  if (stagingRestaurantIds.size === 0) {
    throw new Error("No restaurants found in staging. Seed restaurants before importing staff.");
  }

  const rows = await loadProdMemberships({ prodRef, prodDbPassword });
  const filtered = rows.filter((row) => allowRoles.has(row.role) && stagingRestaurantIds.has(row.restaurant_id));

  if (filtered.length === 0) {
    throw new Error(`No production memberships found for roles: ${Array.from(allowRoles).join(", ")}`);
  }

  const users = new Map<string, StagingUser>();
  for (const row of filtered) {
    const key = row.email.toLowerCase();
    const existing = users.get(key);
    if (existing) {
      existing.roles.add(row.role);
      existing.restaurantIds.add(row.restaurant_id);
      continue;
    }
    users.set(key, {
      email: row.email,
      name: row.name,
      userId: "",
      password: generatePassword(),
      roles: new Set([row.role]),
      restaurantIds: new Set([row.restaurant_id]),
    });
  }

  // Create users and grant memberships.
  for (const user of users.values()) {
    const userId = await ensureStagingUser({
      staging,
      email: user.email,
      name: user.name,
      password: user.password,
    });
    user.userId = userId;

    // Keep both profile tables present so all code paths work.
    const profileUpsert = await staging
      .from("profiles")
      .upsert(
        {
          id: userId,
          email: user.email,
          name: user.name,
          has_access: true,
        },
        { onConflict: "id" },
      )
      .select("id")
      .maybeSingle();
    if (profileUpsert.error) throw profileUpsert.error;

    const userProfileUpsert = await staging
      .from("user_profiles")
      .upsert(
        {
          id: userId,
          name: user.name,
          marketing_opt_in: false,
          is_email_suppressed: false,
        },
        { onConflict: "id" },
      )
      .select("id")
      .maybeSingle();
    if (userProfileUpsert.error) throw userProfileUpsert.error;

    // Choose the highest privilege role they had in prod.
    const role: RestaurantRole = user.roles.has("owner") ? "owner" : user.roles.has("manager") ? "manager" : "host";

    const membershipRows = Array.from(user.restaurantIds).map((restaurantId) => ({
      user_id: userId,
      restaurant_id: restaurantId,
      role,
    }));

    const membershipUpsert = await staging.from("restaurant_memberships").upsert(membershipRows, {
      onConflict: "user_id,restaurant_id",
    });
    if (membershipUpsert.error) throw membershipUpsert.error;
  }

  // Write creds to a gitignored location (never to tasks artifacts).
  const timestamp = new Date().toISOString().replace(/[:-]/g, "").slice(0, 15); // YYYYMMDDTHHMMSS
  const outPath = path.join(repoRoot, "backups", `staging-staff-creds-${timestamp}.csv`);
  const header = "email,password,role,restaurants_access_count,user_id\n";
  const lines = Array.from(users.values())
    .sort((a, b) => a.email.localeCompare(b.email))
    .map((u) => {
      const role = u.roles.has("owner") ? "owner" : u.roles.has("manager") ? "manager" : "host";
      return [u.email, u.password, role, String(u.restaurantIds.size), u.userId].join(",");
    })
    .join("\n");

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, header + lines + "\n", { encoding: "utf-8" });

  console.log("[import-prod-staff] Imported restaurant staff from production into staging.");
  console.log(`- Prod ref: ${prodRef}`);
  console.log(`- Staging URL: ${stagingUrl}`);
  console.log(`- Roles imported: ${Array.from(allowRoles).join(", ")}`);
  console.log(`- Users created/ensured: ${users.size}`);
  console.log(`- Creds CSV (gitignored): ${outPath}`);
}

main().catch((error) => {
  console.error("[import-prod-staff] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
