import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "..");
const envLocalPath = path.join(projectRoot, ".env.local");

if (fs.existsSync(envLocalPath)) {
  loadEnv({ path: envLocalPath, override: false });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set before running this script.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  const { data, error } = await supabase.from("restaurants").select("id, name").limit(1);

  if (error) {
    console.error("Supabase connectivity check failed:", error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.warn("Query succeeded but returned no rows. Verify staging data if this is unexpected.");
  } else {
    const sample = data[0];
    console.log(
      `Supabase connectivity check succeeded. Sample restaurant: ${sample.id} — ${sample.name ?? "<no name>"}.`,
    );
  }
}

main().catch((error) => {
  console.error("Unexpected error while running Supabase connectivity check:", error);
  process.exit(1);
});
