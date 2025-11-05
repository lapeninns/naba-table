#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkResults() {
  console.log('📊 Checking Allocation Results...\n');
  
  // Get status summary by restaurant
  const { data: summary, error: summaryError } = await supabase
    .from('bookings')
    .select('restaurant_id, restaurants(slug), status')
    .eq('booking_date', new Date().toISOString().split('T')[0]);
  
  if (summaryError) {
    console.error('Error:', summaryError);
    return;
  }
  
  const stats: Record<string, { confirmed: number; pending: number; total: number }> = {};
  
  summary?.forEach((b: any) => {
    const slug = b.restaurants?.slug || 'unknown';
    if (!stats[slug]) {
      stats[slug] = { confirmed: 0, pending: 0, total: 0 };
    }
    stats[slug].total++;
    if (b.status === 'confirmed') stats[slug].confirmed++;
    if (b.status === 'pending') stats[slug].pending++;
  });
  
  console.table(stats);
  
  // Get assignment details
  const { data: assignments, error: assignError } = await supabase
    .from('booking_table_assignments')
    .select('booking_id, table_id, table_inventory(table_number)');
  
  if (assignError) {
    console.error('Assignment error:', assignError);
  }
  
  const totalAssignments = assignments?.length || 0;
  const uniqueBookingsWithAssignments = new Set(assignments?.map((a: any) => a.booking_id) || []).size;
  
  console.log('\n📋 Assignment Summary:');
  console.log(`  Total bookings: ${summary?.length || 0}`);
  console.log(`  Confirmed bookings: ${Object.values(stats).reduce((sum, s) => sum + s.confirmed, 0)}`);
  console.log(`  Pending bookings: ${Object.values(stats).reduce((sum, s) => sum + s.pending, 0)}`);
  console.log(`  Total table assignments: ${totalAssignments}`);
  console.log(`  Bookings with assignments: ${uniqueBookingsWithAssignments}`);
  console.log(`  Success rate: ${((uniqueBookingsWithAssignments / (summary?.length || 1)) * 100).toFixed(1)}%\n`);
}

checkResults();
