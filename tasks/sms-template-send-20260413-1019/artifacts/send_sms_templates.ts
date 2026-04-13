import { createClient } from '@supabase/supabase-js';
import { sendTwilioSmsMessage } from '@/lib/twilio/sms';
import { formatDailyBookingSummaryMessage, computeServiceBreakdown } from '@/lib/ops/daily-booking-summary';
import { formatReservationDateShort, formatReservationTimeFromDate } from '@reserve/shared/formatting/booking';

const recipient = '+447467586751';
const restaurantId = 'a050d1ad-1ee0-4ea0-abc2-22c3778aa52c';
const venueName = 'The Old Crown Girton';
const venueTimezone = 'Europe/London';
const venuePhone = '01223 277217';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('bookings')
    .select('status, booking_type, party_size')
    .eq('restaurant_id', restaurantId)
    .eq('booking_date', today);

  if (error) throw error;

  const serviceBreakdown = computeServiceBreakdown(
    (data ?? []).map((booking) => ({
      status: booking.status,
      bookingType: booking.booking_type,
      partySize: booking.party_size ?? 0,
    })),
  );

  const managerBody = formatDailyBookingSummaryMessage({ serviceBreakdown }, { venueName });

  const startAt = new Date('2026-04-14T18:30:00+01:00');
  const detailsLine = `${formatReservationDateShort('2026-04-14', { timezone: venueTimezone })} at ${formatReservationTimeFromDate(startAt, { timezone: venueTimezone })} | 4 guests`;
  const referenceLine = 'Reference: TEST-AB12';
  const manageUrl = 'https://go.nabatable.com/m/TESTAB12';

  const messages = [
    {
      template: 'manager_daily_summary',
      body: managerBody,
    },
    {
      template: 'guest_confirmation',
      body: [
        venueName,
        '',
        'Your booking is confirmed.',
        detailsLine,
        referenceLine,
        '',
        `Manage your booking: ${manageUrl}`,
      ].join('\n'),
    },
    {
      template: 'guest_update',
      body: [
        venueName,
        '',
        'Your booking has been updated.',
        detailsLine,
        referenceLine,
        '',
        `Manage your booking: ${manageUrl}`,
      ].join('\n'),
    },
    {
      template: 'guest_cancellation_customer',
      body: [
        venueName,
        '',
        'Your booking has been cancelled.',
        detailsLine,
        referenceLine,
        '',
        `Contact: ${venuePhone}`,
      ].join('\n'),
    },
    {
      template: 'guest_cancellation_restaurant',
      body: [
        venueName,
        '',
        'Your booking has been cancelled by the restaurant.',
        detailsLine,
        referenceLine,
        '',
        `Contact: ${venuePhone}`,
      ].join('\n'),
    },
  ];

  const results: Array<{ template: string; body: string; messageSid: string | null; status: string | null }> = [];

  for (const message of messages) {
    const result = await sendTwilioSmsMessage({
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      apiKeySid: process.env.TWILIO_API_KEY_SID!,
      apiKeySecret: process.env.TWILIO_API_KEY_SECRET!,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
      shortenUrls: process.env.TWILIO_SHORTEN_URLS === 'true',
      to: recipient,
      body: message.body,
    });

    results.push({
      template: message.template,
      body: message.body,
      messageSid: result.messageSid,
      status: result.status,
    });
  }

  console.log(JSON.stringify({ recipient, today, restaurantId, results }, null, 2));
}

void main();
