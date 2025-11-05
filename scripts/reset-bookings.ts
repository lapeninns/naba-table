#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reset() {
  const today = new Date().toISOString().split('T')[0];
  
  console.log('🔄 Resetting bookings for', today);
  
  // First, get all booking IDs for today
  const { data: bookings, error: bookingError } = await supabase
    .from('bookings')
    .select('id')
    .eq('booking_date', today);
  
  if (bookingError) {
    console.error('Error fetching bookings:', bookingError);
    process.exit(1);
  }
  
  const bookingIds = bookings?.map(b => b.id) || [];
  console.log(`  Found ${bookingIds.length} bookings`);
  
  // Delete all table assignments for these bookings
  if (bookingIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('booking_table_assignments')
      .delete()
      .in('booking_id', bookingIds);
    
    if (deleteError) {
      console.error('Error deleting assignments:', deleteError);
    } else {
      console.log('  ✓ Deleted all table assignments');
    }
  }
  
  // Reset bookings to pending
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'pending' })
    .eq('booking_date', today)
    .select();
  
  if (error) {
    console.error('Error resetting bookings:', error);
    process.exit(1);
  }
  
  console.log('✅ Reset complete:');
  console.log(`  ${data?.length || 0} bookings reset to pending status`);
  console.log(`  All table assignments deleted`);
  console.log(`  Ready for stress test!\n`);
}

reset();
