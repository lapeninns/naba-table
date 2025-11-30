#!/usr/bin/env tsx
/**
 * Comprehensive Booking Flow Test
 * Tests: Create → Edit (reduce) → Edit (increase back)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

const restaurantId = "486de541-a307-4414-b0b1-f774a0e4a9fa"; // White Horse Pub

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getTableAssignments(bookingId: string) {
    const { data } = await supabase
        .from("booking_table_assignments")
        .select("table_id, restaurant_tables:table_id(table_number, capacity)")
        .eq("booking_id", bookingId);

    return data || [];
}

async function waitForAutoAssignment(bookingId: string, maxWait = 15000) {
    const start = Date.now();

    while (Date.now() - start < maxWait) {
        const { data: booking } = await supabase
            .from("bookings")
            .select("status, details")
            .eq("id", bookingId)
            .single();

        if (booking?.status === "confirmed") {
            return { success: true, booking };
        }

        if (booking?.status === "pending") {
            const details = booking.details as any;
            if (details?.pending_admin_reason) {
                return { success: false, reason: details.pending_admin_reason };
            }
        }

        await sleep(1000);
    }

    return { success: false, reason: "timeout" };
}

async function testBookingFlow() {
    console.log("\n" + "=".repeat(80));
    console.log("🧪 BOOKING FLOW TEST - Party Size Changes with Auto-Assignment");
    console.log("=".repeat(80));

    try {
        // Step 1: Create booking with party size 12
        console.log("\n📝 STEP 1: Creating booking with party size 12...");

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const bookingDate = tomorrow.toISOString().split('T')[0];

        const { data: newBooking, error: createError } = await supabase
            .from("bookings")
            .insert({
                restaurant_id: restaurantId,
                party_size: 12,
                booking_date: bookingDate,
                start_time: "19:00:00",
                end_time: "21:00:00",
                status: "pending",
                guest_name: "Test Party 12",
                guest_email: "test12@example.com",
                guest_phone: "+1234567890",
                details: {
                    test: true,
                    created_by: "automated_test",
                    timezone: "Europe/London"
                }
            })
            .select()
            .single();

        if (createError || !newBooking) {
            throw new Error(`Failed to create booking: ${createError?.message}`);
        }

        console.log(`✅ Booking created: ${newBooking.id}`);
        console.log(`   Party size: ${newBooking.party_size}`);
        console.log(`   Status: ${newBooking.status}`);

        // Wait for auto-assignment
        console.log("\n⏳ Waiting for auto-assignment (max 15s)...");
        const result1 = await waitForAutoAssignment(newBooking.id);

        if (result1.success) {
            console.log("✅ Auto-assignment SUCCEEDED");
            const assignments = await getTableAssignments(newBooking.id);
            console.log(`   Tables assigned: ${assignments.length}`);
            assignments.forEach((a: any) => {
                console.log(`   - ${a.restaurant_tables?.table_number} (capacity: ${a.restaurant_tables?.capacity})`);
            });
        } else {
            console.log(`❌ Auto-assignment FAILED: ${result1.reason}`);
            console.log("   This booking will need manual assignment");
        }

        // Step 2: Edit to party size 9
        console.log("\n📝 STEP 2: Editing booking to party size 9...");

        const { data: updated1, error: update1Error } = await supabase
            .from("bookings")
            .update({
                party_size: 9,
                status: "pending", // Reset to pending for re-assignment
            })
            .eq("id", newBooking.id)
            .select()
            .single();

        if (update1Error) {
            throw new Error(`Failed to update booking: ${update1Error.message}`);
        }

        console.log(`✅ Booking updated: ${updated1.id}`);
        console.log(`   Party size: ${updated1.party_size}`);

        // Clear old assignments
        await supabase
            .from("booking_table_assignments")
            .delete()
            .eq("booking_id", newBooking.id);

        console.log("\n⏳ Waiting for auto-assignment (max 15s)...");
        const result2 = await waitForAutoAssignment(newBooking.id);

        if (result2.success) {
            console.log("✅ Auto-assignment SUCCEEDED");
            const assignments = await getTableAssignments(newBooking.id);
            console.log(`   Tables assigned: ${assignments.length}`);
            assignments.forEach((a: any) => {
                console.log(`   - ${a.restaurant_tables?.table_number} (capacity: ${a.restaurant_tables?.capacity})`);
            });
        } else {
            console.log(`❌ Auto-assignment FAILED: ${result2.reason}`);
        }

        // Step 3: Edit to party size 5
        console.log("\n📝 STEP 3: Editing booking to party size 5...");

        const { data: updated2, error: update2Error } = await supabase
            .from("bookings")
            .update({
                party_size: 5,
                status: "pending",
            })
            .eq("id", newBooking.id)
            .select()
            .single();

        if (update2Error) {
            throw new Error(`Failed to update booking: ${update2Error.message}`);
        }

        console.log(`✅ Booking updated: ${updated2.id}`);
        console.log(`   Party size: ${updated2.party_size}`);

        await supabase
            .from("booking_table_assignments")
            .delete()
            .eq("booking_id", newBooking.id);

        console.log("\n⏳ Waiting for auto-assignment (max 15s)...");
        const result3 = await waitForAutoAssignment(newBooking.id);

        if (result3.success) {
            console.log("✅ Auto-assignment SUCCEEDED");
            const assignments = await getTableAssignments(newBooking.id);
            console.log(`   Tables assigned: ${assignments.length}`);
            assignments.forEach((a: any) => {
                console.log(`   - ${a.restaurant_tables?.table_number} (capacity: ${a.restaurant_tables?.capacity})`);
            });
        } else {
            console.log(`❌ Auto-assignment FAILED: ${result3.reason}`);
        }

        // Step 4: Edit BACK to party size 12
        console.log("\n📝 STEP 4: Editing booking BACK to party size 12...");

        const { data: updated3, error: update3Error } = await supabase
            .from("bookings")
            .update({
                party_size: 12,
                status: "pending",
            })
            .eq("id", newBooking.id)
            .select()
            .single();

        if (update3Error) {
            throw new Error(`Failed to update booking: ${update3Error.message}`);
        }

        console.log(`✅ Booking updated: ${updated3.id}`);
        console.log(`   Party size: ${updated3.party_size}`);

        await supabase
            .from("booking_table_assignments")
            .delete()
            .eq("booking_id", newBooking.id);

        console.log("\n⏳ Waiting for auto-assignment (max 15s)...");
        const result4 = await waitForAutoAssignment(newBooking.id);

        if (result4.success) {
            console.log("✅ Auto-assignment SUCCEEDED");
            const assignments = await getTableAssignments(newBooking.id);
            console.log(`   Tables assigned: ${assignments.length}`);
            assignments.forEach((a: any) => {
                console.log(`   - ${a.restaurant_tables?.table_number} (capacity: ${a.restaurant_tables?.capacity})`);
            });
        } else {
            console.log(`❌ Auto-assignment FAILED: ${result4.reason}`);
        }

        // Final summary
        console.log("\n" + "=".repeat(80));
        console.log("📊 TEST SUMMARY");
        console.log("=".repeat(80));
        console.log(`Booking ID: ${newBooking.id}`);
        console.log(`\nStep 1 (Party 12): ${result1.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Step 2 (Party 9):  ${result2.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Step 3 (Party 5):  ${result3.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Step 4 (Party 12): ${result4.success ? '✅ PASS' : '❌ FAIL'}`);

        const allPassed = result1.success && result2.success && result3.success && result4.success;

        if (allPassed) {
            console.log(`\n🎉 ALL TESTS PASSED!`);
        } else {
            console.log(`\n⚠️  Some tests failed - review results above`);
        }

        console.log("\n💡 Note: This test created a test booking. You may want to delete it:");
        console.log(`   DELETE FROM bookings WHERE id = '${newBooking.id}';`);
        console.log("\n" + "=".repeat(80));

    } catch (error) {
        console.error("\n❌ TEST FAILED WITH ERROR:");
        console.error(error);
    }
}

// Run the test
testBookingFlow().catch(console.error);
