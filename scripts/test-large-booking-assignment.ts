#!/usr/bin/env tsx
/**
 * Test assignment for a specific large booking
 */

import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

async function testLargeBookingAssignment() {
  const bookingId = 'COMBO-11-1'; // Party of 11
  
  console.log(`\n🧪 Testing Assignment for Booking: ${bookingId}\n`);
  
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Get booking details
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, restaurant:restaurants(id, name, slug)')
    .eq('reference', bookingId)
    .single();
    
  if (!booking) {
    console.log('❌ Booking not found');
    return;
  }
  
  console.log(`📝 Booking Details:`);
  console.log(`   Reference: ${booking.reference}`);
  console.log(`   Party Size: ${booking.party_size}`);
  console.log(`   Date/Time: ${booking.booking_date} at ${booking.start_time}`);
  console.log(`   Restaurant: ${(booking as any).restaurant.name}`);
  console.log(`   Status: ${booking.status}`);
  
  // Try to get a quote (this runs the algorithm)
  console.log(`\n🎯 Attempting to get table assignment quote...\n`);
  
  const { quoteTablesForBooking } = await import('@/server/capacity/tables');
  
  try {
    const quote = await quoteTablesForBooking({
      bookingId: booking.id,
      createdBy: 'test-script',
      holdTtlSeconds: 180
    });
    
    console.log(`✅ Quote Result:`, JSON.stringify(quote, null, 2));
  } catch (error) {
    console.log(`❌ Error getting quote:`, error);
  }
}

testLargeBookingAssignment().catch(console.error);
