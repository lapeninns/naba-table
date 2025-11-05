#!/usr/bin/env tsx
/**
 * Reset some bookings to test table combinations
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

// Load env BEFORE any imports
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

async function resetForCombinations() {
  const supabaseModule = await import('@/server/supabase');
  const getServiceSupabaseClient = supabaseModule.getServiceSupabaseClient;
  const supabase = getServiceSupabaseClient();

  const restaurantId = "0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a";
  const bookingDate = "2025-11-10";

  console.log("\n🔄 Resetting bookings for combination testing...\n");

  // Get bookings to reset
  const { data: bookingsToReset } = await supabase
    .from("bookings")
    .select("id, party_size, start_time")
    .eq("restaurant_id", restaurantId)
    .eq("booking_date", bookingDate)
    .eq("status", "confirmed")
    .in("party_size", [5, 7, 9])
    .gte("start_time", "17:00:00");

  if (!bookingsToReset || bookingsToReset.length === 0) {
    console.log("No bookings to reset.");
    return;
  }

  const bookingIds = bookingsToReset.map((b) => b.id);

  // Delete existing assignments
  const { error: deleteError } = await supabase
    .from("booking_table_assignments")
    .delete()
    .in("booking_id", bookingIds);

  if (deleteError) {
    console.error("❌ Error deleting assignments:", deleteError);
  }

  // Update bookings to pending
  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: "pending" })
    .in("id", bookingIds);

  if (updateError) {
    console.error("❌ Error updating bookings:", updateError);
    process.exit(1);
  }

  console.log(`✅ Reset ${bookingsToReset.length} bookings to pending:`);
  bookingsToReset.forEach((b: any) => {
    console.log(`   - ${b.id.substring(0, 8)} | ${b.start_time} | party=${b.party_size}`);
  });

  console.log("\n");
}

resetForCombinations().catch(console.error);
