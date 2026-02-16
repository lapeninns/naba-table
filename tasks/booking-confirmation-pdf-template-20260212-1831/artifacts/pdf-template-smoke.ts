import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

import { createSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';

function unescapePdfText(value: string): string {
  return value
    .replace(/\\\\/g, '\\')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
}

function extractTextOperators(buffer: Buffer): string[] {
  const asLatin = buffer.toString('latin1');
  const matches = [...asLatin.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g)];
  return matches.map((match) => unescapePdfText(match[1]).trim()).filter(Boolean);
}

async function main() {
  loadEnv({ path: '.env.local', quiet: true });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.SESSION_RECOVERY_ACCESS_TOKEN_SECRET
    ?? process.env.NEXT_PUBLIC_SESSION_RECOVERY_ACCESS_TOKEN_SECRET
    ?? process.env.SECURITY_SESSION_RECOVERY_ACCESS_TOKEN_SECRET;

  if (!url || !serviceKey || !secret) {
    console.log(JSON.stringify({ ok: false, reason: 'missing_env' }));
    return;
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id,reference,restaurant_id,customer_email,customer_phone,customer_name,party_size,status')
    .not('customer_email', 'is', null)
    .not('customer_phone', 'is', null)
    .not('reference', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error || !booking) {
    console.log(JSON.stringify({ ok: false, reason: 'no_booking' }));
    return;
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name,address')
    .eq('id', booking.restaurant_id)
    .maybeSingle();

  const token = createSessionRecoveryAccessToken({
    restaurantId: booking.restaurant_id,
    email: booking.customer_email,
    phone: booking.customer_phone,
    secret,
  });

  const response = await fetch(
    `http://localhost:3040/api/reservations/${booking.id}/confirmation?access_token=${encodeURIComponent(token)}`,
  );

  const bytes = Buffer.from(await response.arrayBuffer());
  const textOps = extractTextOperators(bytes);
  const joinedText = textOps.join('\n');

  const restaurantName = restaurant?.name ?? null;
  const checks = {
    containsBrand: joinedText.includes('Nab a Table'),
    containsTitle: joinedText.includes('Reservation Confirmation'),
    containsReferenceLabel: joinedText.includes('Reference'),
    containsGuestLabel: joinedText.includes('Guest'),
    containsDateLabel: joinedText.includes('Date'),
    containsTimeLabel: joinedText.includes('Time'),
    containsPartySizeLabel: joinedText.includes('Party Size'),
    containsVenueLabel: joinedText.includes('Venue'),
    containsAddressLabel: joinedText.includes('Address'),
    containsStatusLabel: joinedText.includes('Status'),
    containsNotesLabel: joinedText.includes('Notes'),
    containsReferenceValue: Boolean(booking.reference) && joinedText.includes(booking.reference),
    containsGuestValue: Boolean(booking.customer_name) && joinedText.includes(booking.customer_name),
    containsVenueValue: Boolean(restaurantName) && joinedText.includes(restaurantName),
    containsStatusValue: Boolean(booking.status) && joinedText.toLowerCase().includes(String(booking.status).replace(/_/g, ' ').toLowerCase()),
  };

  const requiredPassed = Object.values({
    containsBrand: checks.containsBrand,
    containsTitle: checks.containsTitle,
    containsReferenceLabel: checks.containsReferenceLabel,
    containsGuestLabel: checks.containsGuestLabel,
    containsDateLabel: checks.containsDateLabel,
    containsTimeLabel: checks.containsTimeLabel,
    containsPartySizeLabel: checks.containsPartySizeLabel,
    containsVenueLabel: checks.containsVenueLabel,
    containsAddressLabel: checks.containsAddressLabel,
    containsStatusLabel: checks.containsStatusLabel,
    containsNotesLabel: checks.containsNotesLabel,
  }).every(Boolean);

  console.log(
    JSON.stringify(
      {
        ok: response.ok && response.status === 200,
        status: response.status,
        contentType: response.headers.get('content-type'),
        bytes: bytes.length,
        requiredPassed,
        checks,
      },
      null,
      2,
    ),
  );
}

void main();
