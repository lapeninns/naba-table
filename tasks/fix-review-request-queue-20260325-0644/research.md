---
task: fix-review-request-queue
timestamp_utc: 2026-03-25T06:44:27Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Research: Fix Missing Review Request Queue Visibility / Enqueue Investigation

## Requirements

- Functional:
  - Verify whether production booking ref `LPTZDB8DCA` has a queued `review_request` email.
  - Restore authoritative queue visibility for Cloudflare delayed jobs so Old Crown Girton jobs can be inspected reliably.
  - Ensure the canonical completion path remains the source of review email scheduling.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI changes expected.
  - Do not expose gateway tokens or service-role secrets in source or logs.
  - Keep production queue semantics intact; no destructive queue operations.

## Existing Patterns & Reuse

- Review emails are queued in `server/jobs/booking-side-effects.ts` from the canonical completion paths:
  - `enqueueCheckOutSideEffects`
  - completed-status transition handling
- Cloudflare queue state is exposed by the Durable Object worker in `cloudflare/email-queue-gateway/src/index.mjs`.
- Deployment uses `scripts/cloudflare/deploy-email-gateway.sh`.

## External Resources

- Cloudflare worker deployment history via `wrangler deployments list` showed a rollback on 2026-03-24T10:59:10Z to version `bc342a38-b76b-418e-9923-d906766726b2`.

## Constraints & Risks

- Production booking `LPTZDB8DCA` exists only in production env, not staging.
- Live gateway summary reports `delayed=32`, but detailed `jobs.delayed.length=10`, so current production visibility is unreliable.
- Deploying the gateway is a production change and must be followed by direct verification.

## Findings

- Booking `LPTZDB8DCA` is production booking `e93fbe2c-2d3c-427f-9c2d-a0407dc0daad`, status `completed`, valid email, checked out at `2026-03-24T21:46:04.660Z`.
- Expected review-request send time for this booking is `2026-03-25T10:55:00Z` based on `end_at + 3h`, adjusted into the next optimal send window.
- Production `email_delivery_log` contains only the initial confirmation email for this booking so far.
- The live Cloudflare gateway always returns only 10 delayed job summaries, even with `jobLimit=all` or large numeric limits.
- The repo worker code already supports `jobLimit=all`, so the deployed worker is likely older than the current source.

## Open Questions (owner, due)

- Q: After restoring full queue visibility, is `review_request:e93fbe2c-2d3c-427f-9c2d-a0407dc0daad` already present in the delayed queue?
  A: Pending gateway redeploy and verification.

## Recommended Direction (with rationale)

- Redeploy the current Cloudflare email queue gateway to production to restore full detailed queue visibility.
- Immediately verify:
  - delayed job detail count matches summary count
  - Old Crown Girton filtered jobs are complete
  - booking `LPTZDB8DCA` is either present as a delayed `review_request` or definitively absent
- If the booking remains absent after visibility is restored, patch the canonical completion-to-enqueue path next with targeted regression coverage.
