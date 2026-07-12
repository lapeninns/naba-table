---
spec_id: MS-integrations-whatsapp-review-delivery
status: draft
risk_class: webhooks
owner: codex
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/05-integrations/**
  - server/jobs/**
  - server/notifications/**
  - lib/env.ts
  - .env.example
  - scripts/**
  - tests/server/jobs/**
  - tests/server/notifications/**
  - tests/config/**
  - tests/scripts/**
implementation_surfaces:
  - server/jobs/**
  - server/notifications/**
  - lib/env.ts
  - .env.example
  - scripts/**
  - tests/server/jobs/**
  - tests/server/notifications/**
  - tests/config/**
  - tests/scripts/**
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - docs/sdlc/verification.md
related_tests:
  - not-yet-created
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

## 3. Strict Constraints and Assumptions

- Review scheduling is independent of valid guest email and global email suppression, but respects
  the venue's existing review-request preference and requires eligible version 2 WhatsApp consent.
- The review email continues under its existing preference and queue semantics. WhatsApp does not
  cancel, replace, or deduplicate the email channel.
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
