---
spec_id: MS-integrations-whatsapp-review-delivery
status: active
risk_class: webhooks
owner: codex
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/05-integrations/**
  - micro-specs/evidence/MS-integrations-whatsapp-review-delivery.json
  - .omo/evidence/task-6-whatsapp-review-production-release.json
  - .omo/evidence/task-5-whatsapp-review-production-release.md
  - tasks/whatsapp-review-production-release-20260712-1921/**
  - CONTINUITY.md
  - server/jobs/booking-side-effects.ts
  - server/jobs/auto-complete-bookings.ts
  - server/notifications/booking-whatsapp-content.ts
  - server/sms/bookings.ts
  - server/queue/email-processing.ts
  - server/queue/mobile-review-intents.ts
  - server/emails/bookings.ts
  - src/app/api/cron/process-emails/route.ts
  - src/app/api/webhook/twilio/whatsapp-status/route.ts
  - lib/env.ts
  - config/env.schema.ts
  - .env.example
  - package.json
  - scripts/whatsapp-review-production-release.ts
  - tests/server/jobs/booking-side-effects.test.ts
  - tests/server/jobs/auto-complete-bookings.test.ts
  - tests/server/notifications/booking-whatsapp-content.test.ts
  - tests/server/email-processing-security.test.ts
  - tests/server/mobile-review-intents.test.ts
  - tests/server/email-queue-route.test.ts
  - tests/server/cron-routes-auth.test.ts
  - tests/server/restaurant-email-templates.test.ts
  - tests/server/sms/bookings.test.ts
  - tests/lib/env.test.ts
  - tests/config/env-schema-target.test.ts
  - tests/scripts/whatsapp-review-production-release.test.ts
  - .omo/evidence/task-5-whatsapp-review-production-release.md
implementation_surfaces:
  - server/jobs/booking-side-effects.ts
  - server/jobs/auto-complete-bookings.ts
  - server/notifications/booking-whatsapp-content.ts
  - server/sms/bookings.ts
  - server/queue/email-processing.ts
  - server/queue/mobile-review-intents.ts
  - server/emails/bookings.ts
  - src/app/api/cron/process-emails/route.ts
  - src/app/api/webhook/twilio/whatsapp-status/route.ts
  - lib/env.ts
  - config/env.schema.ts
  - .env.example
  - package.json
  - scripts/whatsapp-review-production-release.ts
  - tests/server/jobs/booking-side-effects.test.ts
  - tests/server/jobs/auto-complete-bookings.test.ts
  - tests/server/notifications/booking-whatsapp-content.test.ts
  - tests/server/email-processing-security.test.ts
  - tests/server/mobile-review-intents.test.ts
  - tests/server/email-queue-route.test.ts
  - tests/server/cron-routes-auth.test.ts
  - tests/server/restaurant-email-templates.test.ts
  - tests/server/sms/bookings.test.ts
  - tests/lib/env.test.ts
  - tests/config/env-schema-target.test.ts
  - tests/scripts/whatsapp-review-production-release.test.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - docs/sdlc/verification.md
related_tests:
  - tests/config/env-schema-target.test.ts
  - tests/lib/env.test.ts
  - tests/scripts/whatsapp-review-production-release.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm test
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm qa:background-workers
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - Provider approval, staged deployment, rollback, and controlled smoke evidence with PII redacted.
approved_exceptions: []
---

# MS-integrations-whatsapp-review-delivery — Production WhatsApp review delivery and release

## 1. Exact Goal and User-Visible Outcomes

An eligible guest receives one conversational, scannable post-visit WhatsApp review request with
a native **Leave a review** button, alongside the existing review email. Production enables the
five booking templates only after provider approval and a staged, reversible release.

## 2. Blast Radius

In scope are review job orchestration, WhatsApp content variables, provider/env validation,
release/smoke tooling, and focused tests in the declared paths. Out of scope are consent capture,
redirect storage, ledger schema, reminder WhatsApp messages, manager-summary templates, email copy,
provider account mutation outside the controlled release, and unrelated notification channels.
The task packet, continuity ledger, and this spec's evidence ledger are process-only radius entries.

## 3. Strict Constraints and Assumptions

- Review scheduling is independent of valid guest email and global email suppression, but respects
  the venue's existing review-request preference and requires eligible version 2 WhatsApp consent.
- The review email continues under its existing preference and queue semantics. WhatsApp does not
  cancel, replace, or deduplicate the email channel.
- Review WhatsApp work uses the mobile notification intent state and is never stored, processed, or
  reported as an email intent.
- Provider-assigned template category is read back and recorded; code and release checks must not
  assume a category requested at submission.
- Production configuration fails closed unless sender and all five booking Content SIDs are present.

## 4. Decisions Already Made

- The locked booking event set is confirmation, update, guest cancellation, restaurant
  cancellation, and post-visit review. Reminders are absent.
- The review template has a native **Leave a review** URL button backed by the purpose-scoped link.
- Confirmation, update, guest cancellation, restaurant cancellation, and review templates must all
  be provider-approved before any production SID is configured or traffic is enabled.
- Release order is staging migration, staged app/Worker configuration and smoke, then production;
  rollback removes/returns review traffic and config without changing lifecycle delivery.

## 5. Behavioral Requirements (EARS)

- WHEN a booking becomes completed, THE scheduler SHALL evaluate WhatsApp review eligibility even
  if email is missing, invalid, or globally suppressed.
- IF the venue review-request preference is disabled, THEN THE scheduler SHALL enqueue neither the
  review email nor the WhatsApp review request.
- IF version 2 consent, a matching phone snapshot, or a valid review link is absent, THEN THE
  scheduler SHALL skip WhatsApp review without sending SMS and without changing email behavior.
- WHEN eligible, THE job SHALL dispatch one approved review template whose native **Leave a review**
  button receives the actual purpose-scoped HTTPS link required by the provider contract.
- WHEN review delivery is scheduled, THE scheduler SHALL enqueue email only when email is eligible
  and SHALL independently enqueue one durable mobile review intent when WhatsApp is eligible.
- IF one review channel fails or is skipped, THEN THE worker SHALL preserve truthful channel state
  and SHALL NOT block, revive, or misreport the other channel.
- IF attempt finalization is temporarily unavailable after a provider outcome is known, THEN THE
  worker SHALL durably retry only ledger finalization and SHALL NOT resend the WhatsApp template.
- IF a lifecycle WhatsApp send definitely fails before provider acceptance and the first attempt
  finalization write is transient, THEN THE dispatcher SHALL retry bounded finalization and SHALL
  execute the existing SMS fallback after the attempt is truthfully failed.
- IF lifecycle pre-accept failure finalization remains pending, THEN THE booking caller SHALL NOT
  report WhatsApp acceptance and SHALL deliver the ordinary SMS path; review requests remain
  durable finalization-only work with no SMS.
- WHEN provider template state is checked, THE release tooling SHALL require approved status for
  all five booking templates and SHALL record the category returned by the provider.
- IF any of the five templates is unapproved or required production config is absent, THEN THE
  release tooling SHALL refuse enablement without partially configuring the event set.
- WHEN the controlled smoke is explicitly armed, THE runner SHALL send the five events to the
  approved redacted test recipient at T+0, T+60, T+120, T+180, and T+240 seconds in event order.
- IF staged verification or production smoke fails, THEN THE release SHALL roll back review traffic
  and configuration while preserving the existing lifecycle and review-email paths.

## 6. Verification Criteria and Task Breakdown

- Prove email-invalid, email-suppressed, venue-disabled, v1, v2, missing-link, and duplicate paths.
- Prove the native button receives an actual HTTPS short link and review failures never invoke SMS.
- Prove provider readback rejects any unapproved set and records provider-assigned categories.
- Prove staged deploy/rollback and require explicit arming, recipient allowlisting, and exact
  T+0/60/120/180/240 timing before the five-message smoke can mutate provider state.
- Implement as Red → Green → Refactor slices for scheduling, content/env contract, and release tool.
- Record fresh gates with `governance:run-gates --spec MS-integrations-whatsapp-review-delivery --record`.
