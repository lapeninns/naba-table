/* eslint-disable @typescript-eslint/no-explicit-any */
import { config } from "dotenv";
config({ path: ".env.local" });

import { getServiceSupabaseClient } from "../server/supabase";

async function debugBooking() {
    const bookingId = "97fad88e-5c58-46a8-a2db-2882b9a567be";
    const supabase = getServiceSupabaseClient();

    console.log("\n=== Booking Details ===");
    const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

    if (bookingError) {
        console.error("Error fetching booking:", bookingError);
        return;
    }

    console.log(JSON.stringify(booking, null, 2));

    console.log("\n=== Table Inventory ===");
    const { data: restaurantTables, error: tablesError } = await supabase
        .from("table_inventory")
        .select("*")
        .eq("restaurant_id", booking.restaurant_id)
        .order("table_number");

    if (tablesError) {
        console.error("Error fetching tables:", tablesError);
        return;
    }

    console.log(`Total tables: ${restaurantTables.length}`);
    console.log("\nTables breakdown:");
    restaurantTables.forEach((table: any) => {
        console.log(
            `  ${table.table_number}: capacity=${table.capacity}, min=${table.min_party_size ?? "none"}, max=${table.max_party_size ?? "none"}, zone=${table.zone_id ?? "none"}`
        );
    });

    // Check what tables could fit the party size
    const partySize = booking.party_size;
    console.log(`\n=== Party Size: ${partySize} ===`);

    const singleTableMatches = restaurantTables.filter(
        (t: any) =>
            t.capacity >= partySize &&
            (t.min_party_size === null || partySize >= t.min_party_size) &&
            (t.max_party_size === null || partySize <= t.max_party_size)
    );

    console.log(`\nTables that can fit party as single table: ${singleTableMatches.length}`);
    singleTableMatches.forEach((t: any) => {
        console.log(`  ${t.table_number}: capacity=${t.capacity}`);
    });

    const partialMatches = restaurantTables.filter((t: any) => {
        const meetsMin = t.min_party_size === null || partySize >= t.min_party_size;
        const capacity = t.capacity ?? 0;
        return meetsMin && capacity > 0 && capacity < partySize;
    });

    console.log(`\nTables that could contribute to combinations: ${partialMatches.length}`);
    partialMatches.forEach((t: any) => {
        console.log(`  ${t.table_number}: capacity=${t.capacity}, max_party_size=${t.max_party_size ?? "none"}`);
    });

    // Check for holds/conflicts
    console.log("\n=== Active Holds ===");
    const { data: holds } = await supabase
        .from("table_holds")
        .select("*")
        .eq("restaurant_id", booking.restaurant_id)
        .gte("expires_at", new Date().toISOString());

    console.log(`Active holds: ${holds?.length ?? 0}`);

    // Check existing assignments
    console.log("\n=== Current Table Assignments ===");
    const { data: assignments } = await supabase
        .from("booking_table_assignments")
        .select("*")
        .eq("booking_id", bookingId);

    console.log(`Assignments for this booking: ${assignments?.length ?? 0}`);
    if (assignments && assignments.length > 0) {
        assignments.forEach((a: any) => {
            console.log(`  Table ${a.table_id}`);
        });
    }
}

debugBooking().catch(console.error);
