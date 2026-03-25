import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

type RestaurantRow = {
  id: string;
  name: string | null;
  slug: string | null;
  google_review_url: string | null;
  google_map_url: string | null;
  updated_at: string;
};

type RestaurantUpdate = Partial<{
  slug: string | null;
  google_review_url: string | null;
  google_map_url: string | null;
}>;

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
const nextSlug = process.env.NEXT_SLUG?.trim() || "the-old-school-house";
const nextGoogleReviewUrl =
  process.env.NEXT_GOOGLE_REVIEW_URL?.trim() ||
  "https://www.google.com/maps/place/The+Old+School+House/@52.0557627,-0.8504611,17z/data=!3m1!4b1!4m6!3m5!1s0x487701c45888b76d:0xaeebe77da7ae4e4e!8m2!3d52.0557627!4d-0.8504611!16s%2Fg%2F11sn_2wv7s?hl=en-GB&entry=ttu";
const nextGoogleMapUrl =
  process.env.NEXT_GOOGLE_MAP_URL?.trim() ||
  "https://www.google.com/maps/dir/?api=1&destination=London%20Rd%2C%20Stony%20Stratford%2C%20Milton%20Keynes%20MK11%201JA&travelmode=driving";

const supabaseUrl = process.env.PRODUCTION_SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey =
  process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function loadRestaurantById(id: string): Promise<RestaurantRow> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id,name,slug,google_review_url,google_map_url,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load restaurant: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Restaurant not found for id: ${id}`);
  }

  return data as RestaurantRow;
}

async function ensureSlugAvailable(id: string, slug: string): Promise<void> {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id,slug")
    .eq("slug", slug)
    .neq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check slug uniqueness: ${error.message}`);
  }

  if (data?.id) {
    throw new Error(`Slug is already in use: ${slug}`);
  }
}

function buildUpdatePayload(): RestaurantUpdate {
  return {
    slug: nextSlug,
    google_review_url: nextGoogleReviewUrl,
    google_map_url: nextGoogleMapUrl,
  };
}

async function applyUpdate(id: string, update: RestaurantUpdate): Promise<RestaurantRow> {
  const { data, error } = await supabase
    .from("restaurants")
    .update(update)
    .eq("id", id)
    .select("id,name,slug,google_review_url,google_map_url,updated_at")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update restaurant: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Restaurant not found after update for id: ${id}`);
  }

  return data as RestaurantRow;
}

async function main(): Promise<void> {
  const before = await loadRestaurantById(restaurantId);
  await ensureSlugAvailable(restaurantId, nextSlug);

  const payload = buildUpdatePayload();

  console.log(
    JSON.stringify(
      {
        apply,
        restaurantId,
        before,
        payload,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    return;
  }

  const after = await applyUpdate(restaurantId, payload);

  console.log(
    JSON.stringify(
      {
        ok: true,
        restaurantId,
        before,
        after,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error("[update-restaurant-metadata] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
