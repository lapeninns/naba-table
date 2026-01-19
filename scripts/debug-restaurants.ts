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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in your environment or .env.local.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRestaurants() {
  const { data, error } = await supabase.from("restaurants").select("id, name, slug");

  if (error) {
    console.error("Error fetching restaurants:", error);
    return;
  }

  console.log("Restaurants in staging:");
  console.table(data);
}

checkRestaurants();
