# Review growth operations

## Purpose

The review growth engine measures the post-visit journey without storing review text, reviewer identity, email addresses, or phone numbers in its analytics ledger. It uses WhatsApp as the primary channel when the booking has explicit post-visit consent, then uses email as recovery.

## Journey policy

- Start only for a completed booking with a valid Google review destination.
- Prefer WhatsApp when post-visit WhatsApp consent is valid.
- Schedule email 48 hours later when both channels are eligible.
- Move the email recovery forward when Twilio reports WhatsApp failed or undelivered.
- Stop queued sends after the review link is clicked or an outcome is explicitly linked.
- Send at most two review asks per journey.
- Suppress a guest for 90 days after a prior non-suppressed review journey at the same restaurant.
- Never use SMS for a routine review request.

## Metric definitions

| Metric                      | Definition                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Completed visits            | Bookings completed in the selected window.                                                                                                  |
| Eligible                    | Non-suppressed review journeys scheduled in the window.                                                                                     |
| Sent                        | Journeys with at least one provider-accepted send.                                                                                          |
| Reached                     | Journeys with delivered, read, opened, or clicked evidence.                                                                                 |
| Clicked                     | Journeys whose first-party review link was opened.                                                                                          |
| New Google reviews observed | `NEW_REVIEW` notifications for the linked venue in the window. This is directional and is not identity-matched attribution.                 |
| Tracked cost                | Settled Twilio message price in the provider-reported currency. A dash means cost has not settled or is unavailable; it does not mean free. |

Use review-link click rate as the primary first-party conversion measure. Use observed Google reviews per 100 completed visits as the outcome measure. Do not describe Google observations as guest-level attribution.

## Deployment order

1. Apply `supabase/migrations/20260904150000_review_growth_engine.sql` to staging with the repository database safety wrapper.
2. Deploy the web application so the tracking endpoints, sequenced scheduler, webhook ingestion, dashboard, and cost reconciler are active.
3. Deploy booking short links with `pnpm cloudflare:booking-short-links:deploy`. The deploy script applies the D1 access-event migration before the Worker.
4. Confirm the Worker secret `INTERNAL_LINKS_TOKEN` matches `BOOKING_SHORT_LINKS_INTERNAL_TOKEN` in the web application.
5. Confirm Google Business Profile Pub/Sub delivers `NEW_REVIEW` notifications to the existing authenticated ingress.
6. Complete a staging booking, verify WhatsApp is scheduled first, click the review link, and confirm the email follow-up is skipped.

## Monitoring

- Review dashboard: `/app/communications-delivery/reviews`
- Cost reconciliation: `/api/cron/reconcile-review-costs` runs hourly.
- A rise in `failed / sent` indicates provider or consent-quality problems.
- Clicks with no Google observations indicate a Google notification configuration problem or normal guest abandonment; verify ingestion before changing copy.
- A low `reached / eligible` rate is a delivery problem. A low `clicked / reached` rate is a timing or message problem. A low observed-review rate after healthy clicks is an on-page or guest-intent problem.

## Experiment discipline

Change one variable at a time: send window, message copy, or recovery delay. Keep the journey campaign and experiment arm stable for the experiment window, compare reviews per 100 completed visits, and retain delivery/failure rates as guardrails. Do not optimize on open rate alone.

## Privacy and recovery

The journey key is a one-way SHA-256 hash scoped to the restaurant. Event metadata must never contain guest contact details or Google review content. D1 access events contain only an opaque event ID, short-link token, and timestamp. If tracking is unavailable, booking lifecycle operations continue; repair ingestion and reconcile provider outcomes before interpreting the dashboard.
