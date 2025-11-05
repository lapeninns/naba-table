#!/usr/bin/env tsx
/**
 * Seed bookings optimized for testing table combinations
 * 
 * Strategy:
 * - Create party sizes that REQUIRE combinations (9-14 people)
 * - Create party sizes where combinations are OPTIMAL (5, 7, 11)
 * - Distribute evenly across zones and time slots
 * - Mix with normal party sizes to stress test the algorithm
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

async function seedCombinationTestBookings() {
  const { getServiceSupabaseClient } = await import('@/server/supabase');
  const supabase = getServiceSupabaseClient();

  const restaurantId = "0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a";
  const bookingDate = "2025-11-15"; // Friday - busy day

  console.log("\n🌱 Seeding bookings for table combination testing...\n");

  // Get a customer ID to use
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .limit(1)
    .single();

  if (!customer) {
    console.error("❌ No customer found for restaurant. Please ensure customers exist.");
    process.exit(1);
  }

  const customerId = customer.id;

  // Define booking scenarios
  const scenarios = [
    // REQUIRE combinations (no single table fits)
    { partySize: 9, count: 5, reason: "Requires 6+4 or 5+4" },
    { partySize: 11, count: 5, reason: "Requires 6+6 or 8+4" },
    { partySize: 12, count: 3, reason: "Requires 8+4 or 6+6" },
    { partySize: 14, count: 2, reason: "Requires 10+4 or 8+6" },
    
    // OPTIMAL for combinations (better than single table)
    { partySize: 5, count: 10, reason: "2+4=6 (0 waste) vs 6 (1 waste)" },
    { partySize: 7, count: 8, reason: "4+4=8 (1 waste) vs 8 (1 waste)" },
    
    // Normal party sizes (baseline)
    { partySize: 2, count: 15, reason: "Baseline - single table" },
    { partySize: 4, count: 12, reason: "Baseline - single table" },
    { partySize: 6, count: 10, reason: "Baseline - single table" },
    { partySize: 8, count: 6, reason: "Baseline - single table" },
  ];

  // Time slots (dinner service: 17:00-22:00, every 15 minutes)
  const timeSlots = [];
  for (let hour = 17; hour <= 21; hour++) {
    for (let minute of [0, 15, 30, 45]) {
      if (hour === 21 && minute > 30) continue; // Last booking at 21:30
      timeSlots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`);
    }
  }

  // Generate bookings
  const bookingsToCreate = [];
  let bookingCounter = 1;

  for (const scenario of scenarios) {
    for (let i = 0; i < scenario.count; i++) {
      const timeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
      
      bookingsToCreate.push({
        restaurant_id: restaurantId,
        customer_id: customerId,
        booking_date: bookingDate,
        start_time: timeSlot,
        end_time: `${(parseInt(timeSlot.split(':')[0]) + 2).toString().padStart(2, '0')}:${timeSlot.split(':')[1]}:00`,
        party_size: scenario.partySize,
        status: 'pending' as const,
        booking_type: 'dinner',
        customer_name: `Combo Test ${scenario.partySize}p #${i + 1}`,
        customer_email: `combo.test.${scenario.partySize}.${i + 1}@example.com`,
        customer_phone: `555${scenario.partySize.toString().padStart(3, '0')}${i.toString().padStart(4, '0')}`,
        source: 'admin',
        notes: scenario.reason,
        reference: `COMBO-${scenario.partySize}-${i + 1}`,
      });
      
      bookingCounter++;
    }
  }

  console.log(`📊 Booking distribution:`);
  scenarios.forEach((s) => {
    console.log(`   Party of ${s.partySize.toString().padStart(2, ' ')}: ${s.count.toString().padStart(2, ' ')} bookings - ${s.reason}`);
  });
  console.log(`\n   Total: ${bookingsToCreate.length} bookings`);

  console.log(`\n📥 Inserting bookings into database...\n`);

  const { data: inserted, error } = await supabase
    .from("bookings")
    .insert(bookingsToCreate)
    .select("id, party_size, start_time");

  if (error) {
    console.error("❌ Error inserting bookings:", error);
    process.exit(1);
  }

  console.log(`✅ Successfully created ${inserted?.length || 0} bookings for ${bookingDate}\n`);

  // Summary by party size
  const byPartySize = new Map<number, number>();
  inserted?.forEach((b: any) => {
    byPartySize.set(b.party_size, (byPartySize.get(b.party_size) || 0) + 1);
  });

  console.log("📊 Summary:");
  Array.from(byPartySize.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([size, count]) => {
      console.log(`   Party ${size.toString().padStart(2, ' ')}: ${count} bookings`);
    });

  console.log("\n");
}

seedCombinationTestBookings().catch(console.error);
