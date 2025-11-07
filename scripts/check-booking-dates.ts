import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';

loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

const TARGET_RESTAURANT_SLUG = process.env.TARGET_RESTAURANT_SLUG || 'white-horse-pub-waterbeach';

async function main() {
  const { getServiceSupabaseClient } = await import('@/server/supabase');
  const supabase = getServiceSupabaseClient();
  
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('slug', TARGET_RESTAURANT_SLUG)
    .single();
  
  if (!restaurant) {
    console.log('Restaurant not found');
    return;
  }
  
  console.log(`\n📍 ${restaurant.name} (${TARGET_RESTAURANT_SLUG})\n`);
  
  const { data: bookings } = await supabase
    .from('bookings')
    .select('booking_date, status')
    .eq('restaurant_id', restaurant.id)
    .order('booking_date');
  
  if (!bookings || bookings.length === 0) {
    console.log('No bookings found\n');
    return;
  }
  
  const byDate: Record<string, { total: number; pending: number; confirmed: number; other: number }> = {};
  
  bookings.forEach(b => {
    if (!byDate[b.booking_date]) {
      byDate[b.booking_date] = { total: 0, pending: 0, confirmed: 0, other: 0 };
    }
    byDate[b.booking_date].total++;
    if (b.status === 'pending') byDate[b.booking_date].pending++;
    else if (b.status === 'confirmed') byDate[b.booking_date].confirmed++;
    else byDate[b.booking_date].other++;
  });
  
  console.log('Date         | Total | Pending | Confirmed | Other');
  console.log('-------------|-------|---------|-----------|------');
  Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([date, stats]) => {
      console.log(`${date} |   ${String(stats.total).padStart(3)} |     ${String(stats.pending).padStart(3)} |       ${String(stats.confirmed).padStart(3)} |   ${String(stats.other).padStart(3)}`);
    });
  
  console.log(`\nTotal: ${bookings.length} bookings across ${Object.keys(byDate).length} dates\n`);
}

main().catch(console.error);
