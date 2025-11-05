#!/usr/bin/env tsx
/*
 * One-off utility to send a confirmation email for a specific booking ID.
 * Usage:
 *   pnpm tsx -r tsconfig-paths/register scripts/send-booking-confirmation.ts --id <booking-uuid>
 */

import { config as loadEnv } from 'dotenv';
// Prefer .env.local to mirror app behavior (force override)
loadEnv({ path: '.env.local', override: true });

import { sendBookingConfirmationEmail } from '@/server/emails/bookings';
import { getServiceSupabaseClient } from '@/server/supabase';

function parseArgs(): { id: string } {
  const idFlagIndex = process.argv.findIndex((v) => v === '--id');
  if (idFlagIndex === -1 || !process.argv[idFlagIndex + 1]) {
    console.error('Usage: scripts/send-booking-confirmation.ts --id <booking-uuid>');
    process.exit(1);
  }
  const id = process.argv[idFlagIndex + 1];
  return { id };
}

async function main() {
  const { id } = parseArgs();
  const supabase = getServiceSupabaseClient();

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[send-booking-confirmation] failed to load booking', error);
    process.exit(1);
  }
  if (!booking) {
    console.error('[send-booking-confirmation] booking not found:', id);
    process.exit(1);
  }

  console.log(`[send-booking-confirmation] sending to ${booking.customer_email} for booking ${booking.reference} (${booking.status})`);

  await sendBookingConfirmationEmail(booking as any);

  console.log('[send-booking-confirmation] done');
}

main().catch((e) => {
  console.error('[send-booking-confirmation] unexpected error', e);
  process.exit(1);
});
