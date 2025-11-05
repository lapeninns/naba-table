#!/usr/bin/env tsx
/**
 * Fix data integrity: bookings marked confirmed but have no table assignments
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

async function fixOrphanedBookings() {
  const { getServiceSupabaseClient } = await import('@/server/supabase');
  const supabase = getServiceSupabaseClient();

  const restaurantId = "0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a";
  const bookingDate = "2025-11-10";

  console.log("\n🔍 Finding confirmed bookings with no table assignments...\n");

  // Get all confirmed bookings
  const { data: confirmed } = await supabase
    .from("bookings")
    .select("id, party_size, start_time")
    .eq("restaurant_id", restaurantId)
    .eq("booking_date", bookingDate)
    .eq("status", "confirmed");

  if (!confirmed || confirmed.length === 0) {
    console.log("No confirmed bookings found.");
    return;
  }

  // Get all assignments
  const { data: assignments } = await supabase
    .from("booking_table_assignments")
    .select("booking_id")
    .in("booking_id", confirmed.map((b) => b.id));

  const assignedIds = new Set(assignments?.map((a) => a.booking_id) || []);

  // Find orphans
  const orphans = confirmed.filter((b) => !assignedIds.has(b.id));

  if (orphans.length === 0) {
    console.log("✅ No orphaned bookings found. Data integrity OK.");
    return;
  }

  console.log(`❌ Found ${orphans.length} confirmed bookings with NO table assignments:`);
  orphans.forEach((b: any) => {
    console.log(`   ${b.id.substring(0, 8)} | ${b.start_time} | party=${b.party_size}`);
  });

  console.log("\n🔧 Resetting orphaned bookings to pending...\n");

  // Reset to pending and clear zone lock
  const { data: reset, error } = await supabase
    .from("bookings")
    .update({ 
      status: "pending",
      assigned_zone_id: null
    })
    .in("id", orphans.map((b) => b.id))
    .select("id");

  if (error) {
    console.error("❌ Error resetting bookings:", error);
    process.exit(1);
  }

  console.log(`✅ Reset ${reset?.length || 0} bookings to pending\n`);
}

fixOrphanedBookings().catch(console.error);
