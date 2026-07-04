import 'server-only';

import { DateTime } from 'luxon';

import { getTrustedAppOrigin } from '@/lib/site-url';
import {
  isEmailRecipientSuppressedError,
  sendEmail,
} from '@/libs/resend';
import { recordEmailDeliveryLog } from '@/server/emails/email-delivery-log';
import { renderMonthlyReportEmail } from '@/server/emails/monthly-report';
import { recordObservabilityEvent } from '@/server/observability';
import { computeMonthlyVenueReport } from '@/server/reports/monthly-venue-report';
import { getServiceSupabaseClient } from '@/server/supabase';

const MAX_CONCURRENT_SENDS = 5; // Rate limit to avoid Resend overload

export type SendMonthlyReportsSummary = {
  totalVenues: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: Array<{ restaurantId: string; reason: string }>;
};

/**
 * Compute and send monthly venue reports to all venues with a contact email.
 * This runs on the first Wednesday of every month.
 *
 * @param options.dryRun — if true, compute but do not send
 * @param options.restaurantIdFilter — if set, only send to this venue (e.g., for testing)
 * @returns summary of sent/skipped/failed
 */
export async function sendMonthlyVenueReports(options?: {
  dryRun?: boolean;
  restaurantIdFilter?: string;
}): Promise<SendMonthlyReportsSummary> {
  const supabase = getServiceSupabaseClient();
  const dryRun = options?.dryRun ?? false;
  const filterRestaurantId = options?.restaurantIdFilter ?? null;

  const now = DateTime.now();
  const yearMonth = { year: now.year, month: now.month };

  // Fetch all restaurants with contact email
  let query = supabase
    .from('restaurants')
    .select('id, contact_email, monthly_report_enabled')
    .not('contact_email', 'is', null);

  if (filterRestaurantId) {
    query = query.eq('id', filterRestaurantId);
  }

  const { data: venues, error: venuesError } = await query;

  if (venuesError) {
    await recordObservabilityEvent({
      source: 'monthly_reports',
      eventType: 'fetch_venues_failed',
      severity: 'error',
      context: { error: venuesError.message },
    });
    throw new Error(`Failed to fetch venues: ${venuesError.message}`);
  }

  const venuesToSend = (venues || []).filter(
    (v) => v.monthly_report_enabled !== false || filterRestaurantId === v.id,
  );

  console.log(
    `[monthly-reports] found ${venuesToSend.length} venues to send to (${venuesToSend.length} will be attempted)`,
  );

  const summary: SendMonthlyReportsSummary = {
    totalVenues: venuesToSend.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const dashboardOrigin = getTrustedAppOrigin();

  // Process with concurrency control
  for (let i = 0; i < venuesToSend.length; i += MAX_CONCURRENT_SENDS) {
    const batch = venuesToSend.slice(i, i + MAX_CONCURRENT_SENDS);

    const results = await Promise.allSettled(
      batch.map(async (venue) => {
        if (!venue.contact_email) {
          summary.skipped++;
          return { restaurantId: venue.id, status: 'skipped' };
        }

        try {
          // Compute the report
          const report = await computeMonthlyVenueReport(venue.id, yearMonth);
          if (!report) {
            summary.skipped++;
            return { restaurantId: venue.id, status: 'skipped' };
          }

          if (dryRun) {
            console.log(`[monthly-reports] [dry-run] would send to ${venue.id}`);
            summary.skipped++;
            return { restaurantId: venue.id, status: 'dry_run' };
          }

          // Render and send. The renderer owns the subject so the sent Subject header
          // and the email's document <title> can never drift apart.
          const dashboardUrl = `${dashboardOrigin}/dashboard`;
          const { subject, html, text } = renderMonthlyReportEmail({ report, dashboardUrl });

          const emailResult = await sendEmail({
            fromName: 'Team Nabatable',
            to: venue.contact_email,
            subject,
            html,
            text,
            category: 'marketing', // Can unsubscribe; not transactional
            tags: [
              { name: 'email_type', value: 'monthly_report' },
              { name: 'restaurant_id', value: venue.id },
            ],
          });

          // Log delivery
          await recordEmailDeliveryLog({
            restaurantId: venue.id,
            recipientEmail: venue.contact_email,
            messageId: emailResult.messageId,
            emailType: 'monthly_report',
            templateType: 'monthly_report',
            status: 'sent',
            provider: emailResult.provider,
            metadata: {
              month: report.month,
              covers: report.covers.active,
              guests: report.guests.firstTime,
            },
          });

          summary.sent++;
          console.log(`[monthly-reports] sent to ${venue.id}`);
          return { restaurantId: venue.id, status: 'sent' };
        } catch (error) {
          if (isEmailRecipientSuppressedError(error)) {
            console.warn(`[monthly-reports] recipient suppressed: ${venue.id}`);
            summary.skipped++;
            return { restaurantId: venue.id, status: 'suppressed' };
          }

          summary.failed++;
          const reason = error instanceof Error ? error.message : String(error);
          summary.errors.push({ restaurantId: venue.id, reason });

          await recordObservabilityEvent({
            source: 'monthly_reports',
            eventType: 'send_failed',
            severity: 'warning',
            context: {
              restaurantId: venue.id,
              error: reason,
            },
            restaurantId: venue.id,
          });

          console.error(`[monthly-reports] failed for ${venue.id}:`, reason);
          return { restaurantId: venue.id, status: 'failed', error: reason };
        }
      }),
    );

    results.forEach((result) => {
      if (result.status === 'rejected') {
        summary.failed++;
        console.error(
          '[monthly-reports] unexpected error during send:',
          result.reason,
        );
      }
    });
  }

  console.log(
    `[monthly-reports] summary: sent=${summary.sent}, skipped=${summary.skipped}, failed=${summary.failed}`,
  );

  return summary;
}
