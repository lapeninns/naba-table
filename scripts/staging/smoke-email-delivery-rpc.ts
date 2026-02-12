import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

type SummaryRow = Database["public"]["Functions"]["ops_email_delivery_attempts_summary"]["Returns"][number];
type FeedRow = Database["public"]["Functions"]["ops_email_delivery_attempts_feed"]["Returns"][number];

function readEnvFromRepoRoot() {
  const modulePath = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(modulePath), "../..");
  const envLocalPath = path.join(repoRoot, ".env.local");

  if (fs.existsSync(envLocalPath)) {
    loadEnv({ path: envLocalPath, override: false });
  }
}

function requireEnv(key: string): string {
  const value = (process.env[key] ?? "").trim();
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

async function main() {
  readEnvFromRepoRoot();

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const restaurantRes = await supabase.from("restaurants").select("id, name").order("name", { ascending: true }).limit(1);
  if (restaurantRes.error) throw restaurantRes.error;
  const restaurant = restaurantRes.data?.[0];
  if (!restaurant?.id) throw new Error("No restaurants found in staging. Seed restaurants first.");

  const restaurantId = restaurant.id;
  const restaurantName = restaurant.name ?? "<unnamed>";

  const summaryRes = await supabase.rpc("ops_email_delivery_attempts_summary", {
    p_restaurant_id: restaurantId,
    p_range: "24h",
  });
  if (summaryRes.error) throw summaryRes.error;

  const summaryRows = (Array.isArray(summaryRes.data) ? summaryRes.data : []) as SummaryRow[];
  const summaryRow = summaryRows[0] ?? null;
  const total = summaryRow?.total ?? 0;
  const delivered = summaryRow?.delivered ?? 0;
  const failed = summaryRow?.failed ?? 0;

  const feedRes = await supabase.rpc("ops_email_delivery_attempts_feed", {
    p_restaurant_id: restaurantId,
    p_range: "24h",
    p_page: 1,
    p_page_size: 10,
  });
  if (feedRes.error) throw feedRes.error;

  const feedRows = (Array.isArray(feedRes.data) ? feedRes.data : []) as FeedRow[];
  const sample = feedRows[0];

  console.log("[smoke-email-delivery-rpc] OK");
  console.log(`- Supabase URL: ${url}`);
  console.log(`- Restaurant: ${restaurantName} (${restaurantId})`);
  console.log(`- Summary total=${total} delivered=${delivered} failed=${failed}`);
  console.log(`- Feed rows=${feedRows.length}`);
  if (sample) {
    console.log(
      `- Feed sample: messageId=${sample.messageId} recipientEmail=${sample.recipientEmail} currentStatus=${sample.currentStatus}`,
    );
  }
}

main().catch((error) => {
  console.error("[smoke-email-delivery-rpc] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
