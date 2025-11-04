import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug')
    .eq('slug', 'prince-of-wales-pub-bromham')
    .single();

  console.log('Restaurant:', restaurant);

  const { data: bookings, count } = await supabase
    .from('bookings')
    .select('id, booking_date, booking_time, party_size, status', { count: 'exact' })
    .eq('restaurant_id', restaurant!.id)
    .order('booking_date', { ascending: true });

  console.log('\nTotal bookings:', count);
  console.log('\nDate breakdown:');
  
  const byDate: Record<string, { pending: number; confirmed: number; other: number }> = {};
  bookings?.forEach(b => {
    if (!byDate[b.booking_date]) {
      byDate[b.booking_date] = { pending: 0, confirmed: 0, other: 0 };
    }
    if (b.status === 'pending') byDate[b.booking_date].pending++;
    else if (b.status === 'confirmed') byDate[b.booking_date].confirmed++;
    else byDate[b.booking_date].other++;
  });
  
  Object.entries(byDate).forEach(([date, counts]) => {
    console.log(`  ${date}: ${counts.pending} pending, ${counts.confirmed} confirmed, ${counts.other} other`);
  });
  
  // Check specifically for 2025-11-09
  console.log('\n2025-11-09 details:');
  const nov9 = bookings?.filter(b => b.booking_date === '2025-11-09');
  console.log('Count:', nov9?.length || 0);
  if (nov9 && nov9.length > 0) {
    console.log('Sample:', nov9.slice(0, 5));
  }
}

main();
