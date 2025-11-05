#!/usr/bin/env tsx
/**
 * Clear zone locks on pending bookings to allow flexible reassignment
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

async function clearZoneLocks() {
  const { getServiceSupabaseClient } = await import('@/server/supabase');
  const supabase = getServiceSupabaseClient();

  const restaurantId = "0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a";
  const bookingDate = "2025-11-10";

  console.log("\n🔓 Clearing zone locks on pending bookings...\n");

  // Clear assigned_zone_id for all pending bookings
  const { data: updated, error } = await supabase
    .from("bookings")
    .update({ assigned_zone_id: null })
    .eq("restaurant_id", restaurantId)
    .eq("booking_date", bookingDate)
    .eq("status", "pending")
    .select("id, party_size, start_time");

  if (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  console.log(`✅ Cleared zone locks on ${updated?.length || 0} pending bookings`);

  if (updated && updated.length > 0) {
    console.log("\nBookings now free to be assigned to any zone:");
    updated.forEach((b: any) => {
      console.log(`  ${b.id.substring(0, 8)} | ${b.start_time} | party=${b.party_size}`);
    });
  }

  console.log("\n");
}

clearZoneLocks().catch(console.error);
