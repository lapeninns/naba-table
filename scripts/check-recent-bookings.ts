#!/usr/bin/env tsx
/**
 * Check recent bookings and their table assignments
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

// Load env BEFORE any imports
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

async function checkRecentBookings() {
  const supabaseModule = await import('@/server/supabase');
  const getServiceSupabaseClient = supabaseModule.getServiceSupabaseClient;
  const supabase = getServiceSupabaseClient();

  // Get bookings from the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`
      id,
      reference,
      party_size,
      status,
      booking_date,
      start_time,
      restaurant:restaurants(name),
      assignments:booking_table_assignments(table_id)
    `)
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching bookings:", error);
    return;
  }

  if (!bookings || bookings.length === 0) {
    console.log("\n📭 No bookings created in the last hour\n");
    return;
  }

  console.log(`\n📊 Found ${bookings.length} booking(s) in the last hour:\n`);

  for (const booking of bookings) {
    const restaurant = (booking as any).restaurant;
    const assignments = (booking as any).assignments || [];
    
    console.log(`📝 Booking ${booking.reference}`);
    console.log(`   Restaurant: ${restaurant?.name || 'Unknown'}`);
    console.log(`   Party Size: ${booking.party_size}`);
    console.log(`   Status: ${booking.status}`);
    console.log(`   Date/Time: ${booking.booking_date} at ${(booking as any).start_time}`);
    console.log(`   Table Assignments: ${assignments.length}`);
    
    if (assignments.length === 0) {
      console.log(`   ⚠️  NO TABLES ASSIGNED!`);
    } else if (assignments.length === 1) {
      console.log(`   ✅ Single table: ${assignments[0].table_id}`);
    } else {
      console.log(`   🔗 Combination of ${assignments.length} tables:`);
      for (const assignment of assignments) {
        console.log(`      - Table ID: ${assignment.table_id}`);
      }
    }
    console.log('');
  }
}

checkRecentBookings().catch(console.error);
