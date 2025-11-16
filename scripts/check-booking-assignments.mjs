#!/usr/bin/env node
/**
 * Quick script to verify booking table assignments
 * Usage: node scripts/check-booking-assignments.mjs <booking-id>
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const bookingId = process.argv[2] || '39f60e14-a197-4e11-9b0a-a4dec0786ffe';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkBooking(id) {
  console.log(`\n🔍 Checking booking: ${id}\n`);

  // 1. Get booking details
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, status, party_size, restaurant_id, created_at')
    .eq('id', id)
    .single();

  if (bookingError) {
    console.error('❌ Error fetching booking:', bookingError.message);
    return;
  }

  console.log('📋 Booking Details:');
  console.log(`   Status: ${booking.status}`);
  console.log(`   Party Size: ${booking.party_size}`);
  console.log(`   Created: ${new Date(booking.created_at).toLocaleString()}`);

  // 2. Get table assignments
  const { data: assignments, error: assignError } = await supabase
    .from('booking_table_assignments')
    .select('id, table_id, start_at, end_at, merge_group_id, created_at')
    .eq('booking_id', id);

  if (assignError) {
    console.error('❌ Error fetching assignments:', assignError.message);
  } else {
    console.log(`\n✅ Table Assignments: ${assignments.length}`);
    assignments.forEach((a, idx) => {
      console.log(`   ${idx + 1}. Table: ${a.table_id.slice(0, 8)}...`);
      console.log(`      Start: ${new Date(a.start_at).toLocaleString()}`);
      console.log(`      End: ${new Date(a.end_at).toLocaleString()}`);
      console.log(`      Merge Group: ${a.merge_group_id ? a.merge_group_id.slice(0, 8) + '...' : 'null'}`);
    });
  }

  // 3. Get allocations
  const { data: allocations, error: allocError } = await supabase
    .from('allocations')
    .select('id, resource_type, resource_id, window, created_at')
    .eq('booking_id', id);

  if (allocError) {
    console.error('❌ Error fetching allocations:', allocError.message);
  } else {
    console.log(`\n✅ Allocations: ${allocations.length}`);
    allocations.forEach((a, idx) => {
      console.log(`   ${idx + 1}. Type: ${a.resource_type}, Resource: ${a.resource_id.slice(0, 8)}...`);
    });
  }

  // 4. Check capacity outbox
  const { data: outbox, error: outboxError } = await supabase
    .from('capacity_outbox')
    .select('event_type, payload->mergeGroupId, created_at')
    .eq('booking_id', id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!outboxError && outbox.length > 0) {
    console.log(`\n✅ Capacity Outbox Events: ${outbox.length}`);
    outbox.forEach((e, idx) => {
      console.log(`   ${idx + 1}. ${e.event_type}`);
      console.log(`      Merge Group ID: ${e.mergeGroupId || 'null'}`);
    });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(60));
  console.log(`Booking Status: ${booking.status}`);
  console.log(`Table Assignments: ${assignments?.length || 0}`);
  console.log(`Allocations: ${allocations?.length || 0}`);
  console.log(`Outbox Events: ${outbox?.length || 0}`);
  
  const success = (assignments?.length || 0) > 0 && (allocations?.length || 0) > 0;
  console.log(`\n${success ? '✅' : '❌'} Fix Status: ${success ? 'WORKING' : 'NEEDS ATTENTION'}`);
  console.log('='.repeat(60) + '\n');
}

checkBooking(bookingId).catch(console.error);
