/* eslint-disable @typescript-eslint/no-explicit-any */
// Load env vars first
import { config } from "dotenv";
config({ path: ".env.local" });

// Now do imports
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(url, key);

async function debugBooking() {
    const bookingId = "97fad88e-5c58-46a8-a2db-2882b9a567be";

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

    console.log("Booking ID:", booking.id);
    console.log("Restaurant ID:", booking.restaurant_id);
    console.log("Party Size:", booking.party_size);
    console.log("Date:", booking.booking_date);
    console.log("Time:", booking.start_time);
    console.log("Status:", booking.status);
    console.log("Details:", JSON.stringify(booking.details, null, 2));

    console.log("\n=== Restaurant Tables ===");
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
    console.log(`\n=== Analysis for Party Size: ${partySize} ===`);

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

    // Check for issues with maxPartySize
    const blockedByMax = restaurantTables.filter((t: any) => {
        return t.max_party_size !== null && partySize > t.max_party_size;
    });
    console.log(`\nTables blocked by max_party_size constraint: ${blockedByMax.length}`);
    blockedByMax.forEach((t: any) => {
        console.log(`  ${t.table_number}: capacity=${t.capacity}, max_party_size=${t.max_party_size}`);
    });

    // Check for active holds
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

    // Summary
    console.log("\n=== SUMMARY ===");
    if (singleTableMatches.length === 0 && partialMatches.length === 0) {
        console.log("❌ NO TABLES CAN ACCOMMODATE THIS PARTY SIZE");
        console.log("   This explains the error: 'No tables meet the capacity requirements for this party size.'");

        if (blockedByMax.length > 0) {
            console.log(`\n⚠️  ${blockedByMax.length} tables have sufficient capacity but are blocked by max_party_size`);
        }
    } else if (singleTableMatches.length > 0) {
        console.log(`✅ ${singleTableMatches.length} table(s) can accommodate this party as a single table`);
    } else if (partialMatches.length > 0) {
        console.log(`⚠️  No single table works, but ${partialMatches.length} table(s) could be combined`);
    }
}

debugBooking().catch(console.error);
