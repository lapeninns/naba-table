# WhatsApp review production readiness draft

intent: clear
review_required: false
status: superseded
pending_action: use `.omo/plans/whatsapp-review-production-release.md`

## Objective

Make the locked fifth WhatsApp event, `review_request`, production-ready with a native
`Leave a review` button, then activate the complete five-template WhatsApp set only after provider,
consent, redirect, dispatch, and live-delivery gates pass.

## Components

1. `consent-v2` — explicit WhatsApp copy/version covers booking lifecycle messages plus one
   post-visit review request; existing v1 consent is not silently broadened. Status: approved in
   the production-release plan.
2. `review-redirect` — `go.nabatable.com` creates and resolves allowlisted venue review links for
   the fixed-origin Meta URL button. Status: grounded in `cloudflare/booking-short-links/**`.
3. `review-dispatch` — completed-booking review jobs send email as today and idempotently attempt
   eligible WhatsApp without adding an SMS review fallback. Status: grounded in
   `server/queue/email-processing.ts` and `server/notifications/mobile.ts`.
4. `provider-contract` — environment schema and approved `twilio/call-to-action` review template
   use the validated Nabatable redirect suffix. Status: four lifecycle templates currently pending;
   review template not yet created.
5. `production-gates` — staging-first migration/worker proof, Meta approval, Vercel SID/sender
   configuration, real button navigation, callback/read status, and rollback evidence. Status:
   pending plan.

## Settled decisions

- WhatsApp events are the four SMS lifecycle events plus `review_request`; reminders remain
  email-only.
- Review email remains unchanged.
- Review WhatsApp has no SMS fallback.
- The review button uses a fixed `https://go.nabatable.com` action, never an arbitrary dynamic
  Google URL.
- TDD is required for every new behavior; real provider and redirect QA are mandatory before
  production activation.
- The existing dirty `Goal/` work and unrelated user changes are preserved.

## Approval brief

Recommended consent model: publish `booking-plus-review-v2` copy for new/reconfirmed opt-ins that
explicitly names one post-visit review request. Existing `booking-transactional-v1` opt-ins remain
eligible only for the four lifecycle events until reconfirmed. This avoids silently expanding past
consent while keeping one WhatsApp checkbox.

Approval authorizes writing the decision-complete plan only; execution begins in a later explicit
start-work step under the planning skill contract.
