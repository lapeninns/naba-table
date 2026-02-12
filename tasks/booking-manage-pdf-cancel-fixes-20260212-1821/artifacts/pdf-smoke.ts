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
    .select('id,restaurant_id,customer_email,customer_phone')
    .not('customer_email', 'is', null)
    .not('customer_phone', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.log(JSON.stringify({ ok: false, reason: 'no_booking' }));
    return;
  }

  const token = createSessionRecoveryAccessToken({
    restaurantId: data.restaurant_id,
    email: data.customer_email,
    phone: data.customer_phone,
    secret,
  });

  const validEndpoint = `http://localhost:3040/api/reservations/${data.id}/confirmation?access_token=${encodeURIComponent(token)}`;
  const invalidEndpoint = `http://localhost:3040/api/reservations/${data.id}/confirmation?access_token=${encodeURIComponent(`${token}x`)}`;
  const noAuthEndpoint = `http://localhost:3040/api/reservations/${data.id}/confirmation`;

  const [validResponse, invalidResponse, noAuthResponse] = await Promise.all([
    fetch(validEndpoint),
    fetch(invalidEndpoint),
    fetch(noAuthEndpoint),
  ]);

  const validBytes = await validResponse.arrayBuffer();

  console.log(JSON.stringify({
    ok: true,
    valid: {
      status: validResponse.status,
      contentType: validResponse.headers.get('content-type'),
      contentDisposition: Boolean(validResponse.headers.get('content-disposition')),
      byteLength: validBytes.byteLength,
    },
    invalid: { status: invalidResponse.status },
    noAuth: { status: noAuthResponse.status },
  }));
}

void main();
