import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "..");
const envLocalPath = path.join(projectRoot, ".env.local");

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
const email = process.env.USER_EMAIL?.trim();
const password = process.env.USER_PASSWORD;
const userIdOverride = process.env.USER_ID?.trim() || null;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

if (!email || !password) {
  console.error("Set USER_EMAIL and USER_PASSWORD to continue.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserIdByEmailViaAdmin(): Promise<string | null> {
  const pageSize = 200;
  const maxPages = 20;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: pageSize });
    if (error) {
      console.warn(
        "[ensure-auth-user] listUsers failed; falling back to DB lookup.",
        error.message,
      );
      return null;
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === email?.toLowerCase());
    if (match?.id) {
      return match.id;
    }

    if (data.users.length < pageSize) {
      break;
    }
  }

  return null;
}

async function getUserIdByEmail(): Promise<{ id: string; confirmed: string | null } | null> {
  if (!dbUrl) {
    return null;
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query(
      "select id, email_confirmed_at from auth.users where email = $1 limit 1",
      [email],
    );
    if (result.rows.length === 0) {
      return null;
    }
    return { id: result.rows[0].id as string, confirmed: result.rows[0].email_confirmed_at as string | null };
  } catch (error) {
    console.warn(
      "[ensure-auth-user] Unable to query auth.users; falling back to createUser.",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  } finally {
    await client.end();
  }
}

async function main() {
  if (userIdOverride) {
    const { error } = await supabase.auth.admin.updateUserById(userIdOverride, {
      password,
      email_confirm: true,
    });

    if (error) {
      throw new Error(`Failed to update user by id: ${error.message}`);
    }

    console.log("Auth user updated:", { id: userIdOverride, email });
    return;
  }

  const adminMatch = await findUserIdByEmailViaAdmin();
  if (adminMatch) {
    const { error } = await supabase.auth.admin.updateUserById(adminMatch, {
      password,
      email_confirm: true,
    });

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    console.log("Auth user updated:", { id: adminMatch, email });
    return;
  }

  const existing = await getUserIdByEmail();

  if (!existing) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user?.id) {
      const message = error?.message ?? "unknown error";
      if (/already|exists|duplicate/i.test(message)) {
        throw new Error(
          "User already exists. Provide USER_ID to reset the password without DB lookup.",
        );
      }
      throw new Error(`Failed to create user: ${message}`);
    }

    console.log("Auth user created:", { id: data.user.id, email });
    return;
  }

  const { error } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }

  console.log("Auth user updated:", { id: existing.id, email, emailConfirmed: existing.confirmed ?? null });
}

void main().catch((error) => {
  console.error("[ensure-auth-user] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
