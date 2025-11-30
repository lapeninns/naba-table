#!/usr/bin/env tsx
/**
 * Direct test of auto-assignment using the modification flow
 * This test modifies the existing pending booking to trigger auto-assignment
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

// The booking that was failing
const EXISTING_BOOKING_ID = "97fad88e-5c58-46a8-a2db-2882b9a567be";

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeApiRequest(method: string, path: string, body?: any) {
    const response = await fetch(`http://localhost:3000${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API ${method} ${path} failed: ${response.status} - ${text}`);
    }

    return response.json();
}

async function testModificationFlow() {
    console.log("\n" + "=".repeat(80));
    console.log("🧪 AUTO-ASSIGNMENT TEST VIA MODIFICATION FLOW");
    console.log("=".repeat(80));
    console.log(`\nUsing existing booking: ${EXISTING_BOOKING_ID}`);

    try {
        // Get current booking state
        const { data: original } = await supabase
            .from("bookings")
            .select("*")
            .eq("id", EXISTING_BOOKING_ID)
            .single();

        if (!original) {
            throw new Error("Booking not found");
        }

        console.log("\n📊 Original Booking:");
        console.log(`   Party size: ${original.party_size}`);
        console.log(`   Status: ${original.status}`);
        console.log(`   Date: ${original.booking_date}`);
        console.log(`   Time: ${original.start_time}`);

        // Clear any existing assignments
        await supabase
            .from("booking_table_assignments")
            .delete()
            .eq("booking_id", EXISTING_BOOKING_ID);

        console.log("\n🗑️  Cleared existing table assignments");

        // Test 1: Try auto-assignment with party size 12 via API
        console.log("\n📝 TEST 1: Modify to party size 12 (via API)");

        try {
            await makeApiRequest(
                "PUT",
                `/api/bookings/${EXISTING_BOOKING_ID}`,
                { party_size: 12 }
            );

            console.log(`   ✅ API call succeeded`);

            // Wait for auto-assignment
            await sleep(5000);

            const { data: after1 } = await supabase
                .from("bookings")
                .select("status, party_size")
                .eq("id", EXISTING_BOOKING_ID)
                .single();

            console.log(`   Status: ${after1!.status}`);

            if (after1!.status === "confirmed") {
                console.log("   ✅ AUTO-ASSIGNMENT SUCCEEDED!");

                const { data: assignments } = await supabase
                    .from("booking_table_assignments")
                    .select("table_id, restaurant_tables:table_id(table_number, capacity)")
                    .eq("booking_id", EXISTING_BOOKING_ID);

                console.log(`   Tables assigned: ${assignments?.length || 0}`);
                assignments?.forEach((a: any) => {
                    console.log(`   - ${a.restaurant_tables?.table_number} (capacity: ${a.restaurant_tables?.capacity})`);
                });
            } else {
                console.log(`   ❌ Still ${after1!.status} - auto-assignment may have failed`);
            }
        } catch (apiError) {
            console.error("   ❌ API call failed:", apiError);
        }

        // Test 2: Modify to party size 9
        console.log("\n📝 TEST 2: Modify to party size 9");

        await supabase
            .from("booking_table_assignments")
            .delete()
            .eq("booking_id", EXISTING_BOOKING_ID);

        try {
            await makeApiRequest(
                "PUT",
                `/api/bookings/${EXISTING_BOOKING_ID}`,
                { party_size: 9 }
            );

            await sleep(5000);

            const { data: after2 } = await supabase
                .from("bookings")
                .select("status")
                .eq("id", EXISTING_BOOKING_ID)
                .single();

            console.log(`   Status: ${after2!.status}`);
            console.log(after2!.status === "confirmed" ? "   ✅ PASS" : "   ❌ FAIL");
        } catch (error) {
            console.error("   ❌ Failed:", error);
        }

        // Test 3: Modify to party size 5
        console.log("\n📝 TEST 3: Modify to party size 5");

        await supabase
            .from("booking_table_assignments")
            .delete()
            .eq("booking_id", EXISTING_BOOKING_ID);

        try {
            await makeApiRequest(
                "PUT",
                `/api/bookings/${EXISTING_BOOKING_ID}`,
                { party_size: 5 }
            );

            await sleep(5000);

            const { data: after3 } = await supabase
                .from("bookings")
                .select("status")
                .eq("id", EXISTING_BOOKING_ID)
                .single();

            console.log(`   Status: ${after3!.status}`);
            console.log(after3!.status === "confirmed" ? "   ✅ PASS" : "   ❌ FAIL");
        } catch (error) {
            console.error("   ❌ Failed:", error);
        }

        // Test 4: Modify BACK to party size 12
        console.log("\n📝 TEST 4: Modify BACK to party size 12");

        await supabase
            .from("booking_table_assignments")
            .delete()
            .eq("booking_id", EXISTING_BOOKING_ID);

        try {
            await makeApiRequest(
                "PUT",
                `/api/bookings/${EXISTING_BOOKING_ID}`,
                { party_size: 12 }
            );

            await sleep(5000);

            const { data: final } = await supabase
                .from("bookings")
                .select("status, party_size")
                .eq("id", EXISTING_BOOKING_ID)
                .single();

            console.log(`   Status: ${final!.status}`);
            console.log(final!.status === "confirmed" ? "   ✅ PASS" : "   ❌ FAIL");

            if (final!.status === "confirmed") {
                const { data: finalAssignments } = await supabase
                    .from("booking_table_assignments")
                    .select("table_id, restaurant_tables:table_id(table_number, capacity)")
                    .eq("booking_id", EXISTING_BOOKING_ID);

                console.log(`\n   Final assignment for party of 12:`);
                finalAssignments?.forEach((a: any) => {
                    console.log(`   - ${a.restaurant_tables?.table_number} (capacity: ${a.restaurant_tables?.capacity})`);
                });

                const totalCap = finalAssignments?.reduce((sum: number, a: any) =>
                    sum + (a.restaurant_tables?.capacity || 0), 0);
                console.log(`   Total capacity: ${totalCap}`);
            }
        } catch (error) {
            console.error("   ❌ Failed:", error);
        }

        console.log("\n" + "=".repeat(80));
        console.log("✅ TEST COMPLETE");
        console.log("=".repeat(80) + "\n");

    } catch (error) {
        console.error("\n❌ TEST FAILED:");
        console.error(error);
        console.log("\n" + "=".repeat(80) + "\n");
    }
}

testModificationFlow().catch(console.error);
