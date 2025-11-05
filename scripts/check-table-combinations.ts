#!/usr/bin/env tsx
/**
 * Check for bookings with multiple table assignments (table combinations)
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

// Load env BEFORE any imports
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

async function checkTableCombinations() {
  const supabaseModule = await import('@/server/supabase');
  const getServiceSupabaseClient = supabaseModule.getServiceSupabaseClient;
  const supabase = getServiceSupabaseClient();

  const restaurantId = "0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a";
  const bookingDate = new Date().toISOString().split('T')[0]; // Today's date (YYYY-MM-DD)

  console.log("\n🔍 Checking for table combinations...\n");

  // Get all confirmed bookings with their table assignments
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      `
      id,
      party_size,
      start_time,
      status,
      booking_table_assignments (
        table_id,
        table_inventory (
          table_number,
          capacity
        )
      )
    `
    )
    .eq("restaurant_id", restaurantId)
    .eq("booking_date", bookingDate)
    .eq("status", "confirmed")
    .order("start_time");

  if (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  // Group and analyze
  const singleTable: any[] = [];
  const multiTable: any[] = [];

  bookings?.forEach((booking) => {
    const numTables = booking.booking_table_assignments?.length || 0;

    if (numTables > 1) {
      multiTable.push(booking);
    } else if (numTables === 1) {
      singleTable.push(booking);
    }
  });

  // Display results
  console.log("📊 ASSIGNMENT BREAKDOWN:\n");
  console.log(`  Total confirmed bookings: ${bookings?.length || 0}`);
  console.log(`  ✅ Single table assignments: ${singleTable.length}`);
  console.log(`  🔗 Multi-table combinations: ${multiTable.length}`);

  if (multiTable.length > 0) {
    console.log("\n\n🎯 TABLE COMBINATIONS FOUND:\n");
    multiTable.forEach((booking) => {
      const tables = booking.booking_table_assignments
        .map(
          (bta: any) =>
            `${bta.table_inventory.table_number} (cap ${bta.table_inventory.capacity})`
        )
        .join(" + ");

      const totalCapacity = booking.booking_table_assignments.reduce(
        (sum: number, bta: any) => sum + bta.table_inventory.capacity,
        0
      );

      console.log(
        `  ${booking.id.substring(0, 8)} | ${booking.start_time} | party=${booking.party_size} | ${booking.booking_table_assignments.length} tables:`
      );
      console.log(`    → ${tables} (total cap: ${totalCapacity})`);
    });
  } else {
    console.log("\n\n❌ NO TABLE COMBINATIONS FOUND");
    console.log("\nAll assignments use single tables only.");
  }

  // Show sample of large parties using single tables
  const largeSingleTable = singleTable.filter((b) => b.party_size >= 6);

  if (largeSingleTable.length > 0) {
    console.log(
      `\n\n📋 LARGE PARTIES (6+) USING SINGLE TABLES (${largeSingleTable.length}):\n`
    );

    largeSingleTable.slice(0, 10).forEach((booking) => {
      const table = booking.booking_table_assignments[0]?.table_inventory;
      const wasteSeats = table ? table.capacity - booking.party_size : 0;
      const wastePercent = table
        ? ((wasteSeats / table.capacity) * 100).toFixed(1)
        : "0";

      console.log(
        `  ${booking.id.substring(0, 8)} | ${booking.start_time} | party=${booking.party_size} → Table ${table?.table_number} (cap ${table?.capacity}) | waste: ${wasteSeats} seats (${wastePercent}%)`
      );
    });

    if (largeSingleTable.length > 10) {
      console.log(`  ... and ${largeSingleTable.length - 10} more`);
    }
  }

  console.log("\n");
}

checkTableCombinations().catch(console.error);
