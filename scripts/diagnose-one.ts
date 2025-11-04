import { config as loadEnv } from 'dotenv';
import { resolve as resolvePath } from 'path';
loadEnv({ path: resolvePath(process.cwd(), '.env.local') });
loadEnv({ path: resolvePath(process.cwd(), '.env.development') });
loadEnv({ path: resolvePath(process.cwd(), '.env') });

// Defer imports until after env is loaded

async function main() {
  const supabaseModule = await import('@/server/supabase');
  const capacityModule = await import('@/server/capacity/tables');
  const supabase = supabaseModule.getServiceSupabaseClient();
  const slug = 'prince-of-wales-pub-bromham';
  const date = '2025-11-10';

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('slug', slug)
    .single();
  if (!restaurant) throw new Error('restaurant not found');

  const { data: b } = await supabase
    .from('bookings')
    .select('id, start_time, party_size, status')
    .eq('restaurant_id', restaurant.id)
    .eq('booking_date', date)
    .eq('status', 'pending')
    .order('start_time', { ascending: true })
    .limit(1);

  if (!b || b.length === 0) {
    console.log('No pending bookings found');
    return;
  }

  const booking = b[0]!;
  console.log('Diagnosing booking:', booking.id, booking.start_time, 'party', booking.party_size);

  const result = await capacityModule.quoteTablesForBooking({
    bookingId: booking.id,
    createdBy: 'diagnose-one',
    holdTtlSeconds: 60,
    maxTables: 4,
    requireAdjacency: false,
  });

  console.log('Result hold:', Boolean(result.hold), 'reason:', result.reason);
  console.log('Alternates:', result.alternates.length);
  if (result.candidate) {
    console.log('Candidate:', result.candidate);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
