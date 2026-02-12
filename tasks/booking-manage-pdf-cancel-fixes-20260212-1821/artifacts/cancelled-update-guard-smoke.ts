import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

import { createSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';

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

  const { data, error } = await supabase
    .from('bookings')
    .select('id,restaurant_id,customer_email,customer_phone,start_at,end_at,party_size,notes,status')
    .eq('status', 'cancelled')
    .not('customer_email', 'is', null)
    .not('customer_phone', 'is', null)
    .not('start_at', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.log(JSON.stringify({ ok: false, reason: 'no_cancelled_booking' }));
    return;
  }

  const token = createSessionRecoveryAccessToken({
    restaurantId: data.restaurant_id,
    email: data.customer_email,
    phone: data.customer_phone,
    secret,
  });

  const response = await fetch(`http://localhost:3040/api/bookings/${data.id}?access_token=${encodeURIComponent(token)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      startIso: data.start_at,
      endIso: data.end_at ?? undefined,
      partySize: data.party_size ?? 2,
      notes: data.notes ?? null,
    }),
  });

  const payload = await response.json().catch(() => null);

  console.log(JSON.stringify({
    ok: true,
    status: response.status,
    code: payload?.code ?? null,
    error: payload?.error ?? null,
  }));
}

void main();
