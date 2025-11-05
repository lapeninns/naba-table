#!/usr/bin/env tsx
import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });

async function getBookingType() {
  const { getServiceSupabaseClient } = await import('@/server/supabase');
  const supabase = getServiceSupabaseClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select('booking_type')
    .eq('restaurant_id', '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a')
    .limit(1)
    .single();

  console.log('Booking type:', booking?.booking_type);

  const { data: occasions } = await supabase
    .from('booking_occasions')
    .select('id')
    .limit(5);

  console.log('Available occasion IDs:', occasions?.map((o: any) => o.id));
}
getBookingType();
