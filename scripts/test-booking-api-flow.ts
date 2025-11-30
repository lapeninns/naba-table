#!/usr/bin/env tsx
/**
 * Booking Flow Test using API endpoints
 * Tests the complete flow including auto-assignment
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { config } from "dotenv";
config({ path: ".env.local" });

const BASE_URL = "http://localhost:3000";

async function apiCall(method: string, path: string, body?: any) {
    const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
    }

    return data;
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBookingFlow() {
    console.log("\n" + "=".repeat(80));
    console.log("🧪 BOOKING FLOW API TEST");
    console.log("=".repeat(80));
    console.log("\n⚠️  Make sure the dev server is running: pnpm run dev\n");

    try {
        const restaurantId = "486de541-a307-4414-b0b1-f774a0e4a9fa";
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const bookingDate = tomorrow.toISOString().split('T')[0];

        // Step 1: Create booking with party size 12
        console.log("\n📝 STEP 1: Creating booking with party size 12...");

        const createPayload = {
            restaurantId,
            partySize: 12,
            bookingDate,
            startTime: "19:00",
            guestName: "Test Party 12",
            guestEmail: "test12@example.com",
            guestPhone: "+1234567890",
        };

        const created = await apiCall("POST", "/api/bookings", createPayload);
        console.log(`✅ Booking created: ${created.id}`);
        console.log(`   Status: ${created.status}`);
        console.log(`   Party size: ${created.partySize || created.party_size}`);

        if (created.tableAssignments) {
            console.log(`   Tables assigned: ${created.tableAssignments.length}`);
            created.tableAssignments.forEach((t: any) => {
                console.log(`   - ${t.tableNumber || t.table_number}`);
            });
        }

        await sleep(3000); // Allow auto-assignment to complete

        // Check status after auto-assignment
        let booking = await apiCall("GET", `/api/bookings/${created.id}`);
        console.log(`\n   Status after auto-assignment: ${booking.status}`);

        if (booking.status === "confirmed") {
            console.log("   ✅ AUTO-ASSIGNMENT SUCCEEDED for party of 12!");
        } else {
            console.log(`   ❌ AUTO-ASSIGNMENT FAILED (Status: ${booking.status})`);
        }

        // Step 2: Edit to party size 9
        console.log("\n📝 STEP 2: Editing to party size 9...");

        const updated1 = await apiCall("PUT", `/api/bookings/${created.id}`, {
            partySize: 9,
        });

        console.log(`✅ Updated to party size: ${updated1.partySize || updated1.party_size}`);

        await sleep(3000);
        booking = await apiCall("GET", `/api/bookings/${created.id}`);
        console.log(`   Status after edit: ${booking.status}`);

        if (booking.status === "confirmed") {
            console.log("   ✅ AUTO-ASSIGNMENT SUCCEEDED for party of 9!");
        } else {
            console.log(`   ⚠️  Status: ${booking.status}`);
        }

        // Step 3: Edit to party size 5
        console.log("\n📝 STEP 3: Editing to party size 5...");

        const updated2 = await apiCall("PUT", `/api/bookings/${created.id}`, {
            partySize: 5,
        });

        console.log(`✅ Updated to party size: ${updated2.partySize || updated2.party_size}`);

        await sleep(3000);
        booking = await apiCall("GET", `/api/bookings/${created.id}`);
        console.log(`   Status after edit: ${booking.status}`);

        if (booking.status === "confirmed") {
            console.log("   ✅ AUTO-ASSIGNMENT SUCCEEDED for party of 5!");
        } else {
            console.log(`   ⚠️  Status: ${booking.status}`);
        }

        // Step 4: Edit BACK to party size 12
        console.log("\n📝 STEP 4: Editing BACK to party size 12...");

        const updated3 = await apiCall("PUT", `/api/bookings/${created.id}`, {
            partySize: 12,
        });

        console.log(`✅ Updated to party size: ${updated3.partySize || updated3.party_size}`);

        await sleep(3000);
        booking = await apiCall("GET", `/api/bookings/${created.id}`);
        console.log(`   Status after edit: ${booking.status}`);

        if (booking.status === "confirmed") {
            console.log("   ✅ AUTO-ASSIGNMENT SUCCEEDED for party of 12 (again)!");

            if (booking.tableAssignments) {
                console.log(`   Tables assigned: ${booking.tableAssignments.length}`);
                const totalCapacity = booking.tableAssignments.reduce(
                    (sum: number, t: any) => sum + (t.capacity || 0),
                    0
                );
                console.log(`   Total capacity: ${totalCapacity}`);
            }
        } else {
            console.log(`   ❌ AUTO-ASSIGNMENT FAILED (Status: ${booking.status})`);
        }

        // Summary
        console.log("\n" + "=".repeat(80));
        console.log("📊 TEST COMPLETE");
        console.log("=".repeat(80));
        console.log(`\nBooking ID: ${created.id}`);
        console.log(`Final Status: ${booking.status}`);
        console.log(`Final Party Size: ${booking.partySize || booking.party_size}`);

        if (booking.status === "confirmed") {
            console.log("\n🎉 SUCCESS! Auto-assignment is working correctly.");
            console.log("   The kMax=5 fix allows party of 12 to be seated with 4-5 tables.");
        } else {
            console.log("\n⚠️  Warning: Booking did not auto-confirm.");
            console.log("   Check server logs for details.");
        }

        console.log("\n💡 To delete the test booking:");
        console.log(`   DELETE FROM bookings WHERE id = '${created.id}';`);
        console.log("\n" + "=".repeat(80) + "\n");

    } catch (error: any) {
        console.error("\n❌ TEST FAILED:");
        console.error(error.message);
        console.error("\n💡 Make sure:");
        console.error("   1. Dev server is running (pnpm run dev)");
        console.error("   2. Database is accessible");
        console.error("   3. FEATURE_ALLOCATOR_K_MAX=5 in .env.local");
        console.error("\n" + "=".repeat(80) + "\n");
    }
}

testBookingFlow().catch(console.error);
