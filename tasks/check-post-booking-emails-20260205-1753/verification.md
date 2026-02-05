---
task: check-post-booking-emails
timestamp_utc: 2026-02-05T17:53:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- N/A (no UI changes planned).

## Test Outcomes

- Local:
  - `pnpm run lint` (warnings only)
  - `pnpm run typecheck`
  - `pnpm run build`
- Production (Vercel):
  - Deployed and aliased to `https://app.nabatable.com` on 2026-02-05.
  - Backfilled and triggered review-request emails for completed bookings in the last 72 hours (counts below).

## Artifacts

- Queue status snapshot: `artifacts/queue-status.json` (if collected)
- Queue due summary: `artifacts/queue-due-summary.json`
- Cron no-auth probe: `artifacts/cron-process-emails-noauth.json`
- Resend audit output: `artifacts/resend-review-audit.json` (if collected)
- Cron review-only trigger: `artifacts/cron-process-emails-review-filter.json`

## Known Issues

- [ ] Production Supabase project backing `app.nabatable.com` does not currently expose `public.email_delivery_log` to PostgREST (schema cache reports missing). Email sending remains functional, but delivery logging and review-request idempotency via DB log are degraded until the table is available.

## Sign-off

- [ ] Engineering
- [ ] QA

## Production Backfill (2026-02-05 UTC)

- Completed bookings in last 72 hours: `13`
- Completed bookings with a valid guest email: `12`
- Review-request jobs enqueued: `12`
- Review-request jobs processed: `12` (final manual drain call processed `2`; remaining `10` were processed earlier)
