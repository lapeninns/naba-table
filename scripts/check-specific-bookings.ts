#!/usr/bin/env tsx
import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });

async function check() {
  const { getServiceSupabaseClient } = await import('@/server/supabase');
  const supabase = getServiceSupabaseClient();

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, party_size, start_time, status')
    .eq('restaurant_id', '0babe9cf-4656-4c7f-bb60-fc3da6cb7e4a')
    .eq('booking_date', '2025-11-10')
    .in('party_size', [5, 7])
    .order('start_time');

  console.log('\nBooking Status Summary:\n');
  bookings?.forEach((b: any) => {
    console.log(`  ${b.id.substring(0, 8)} | ${b.start_time} | party=${b.party_size} | status=${b.status}`);
  });

  const bookingIds = bookings?.map((b) => b.id) || [];
  
  const { data: assignments } = await supabase
    .from('booking_table_assignments')
    .select(`
      booking_id,
      table_id,
      table_inventory (table_number, capacity)
    `)
    .in('booking_id', bookingIds);

  console.log(`\nTable assignments: ${assignments?.length || 0}\n`);
  
  // Group by booking
  const byBooking = new Map<string, any[]>();
  assignments?.forEach((a: any) => {
    if (!byBooking.has(a.booking_id)) {
      byBooking.set(a.booking_id, []);
    }
    byBooking.get(a.booking_id)!.push(a);
  });

  bookingIds.forEach((id: string) => {
    const tables = byBooking.get(id) || [];
    const tableStr = tables.map((t: any) => 
      `${t.table_inventory.table_number} (cap ${t.table_inventory.capacity})`
    ).join(' + ');
    
    const emoji = tables.length > 1 ? '🔗' : (tables.length === 1 ? '  ' : '❌');
    console.log(`${emoji} ${id.substring(0, 8)} → ${tables.length} table(s): ${tableStr || '(none)'}`);
  });

  console.log('\n');
}
check();
