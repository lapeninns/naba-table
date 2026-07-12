---
spec_id: MS-integrations-whatsapp-dispatch-fallback
status: active
risk_class: webhooks
owner: codex
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/05-integrations/**
  - server/notifications/**
  - server/sms/**
  - lib/twilio/**
  - src/app/api/webhook/twilio/**
  - tests/server/notifications/**
  - tests/server/twilio-whatsapp-status-webhook-route.test.ts
  - tests/lib/twilio-sms.test.ts
  - config/env.schema.ts
  - lib/env.ts
  - .env.example
implementation_surfaces:
  - server/notifications/**
  - server/sms/**
  - lib/twilio/**
  - src/app/api/webhook/twilio/**
  - tests/server/notifications/**
  - tests/server/twilio-whatsapp-status-webhook-route.test.ts
  - tests/lib/twilio-sms.test.ts
  - config/env.schema.ts
  - lib/env.ts
  - .env.example
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - not-yet-created
verification_gates:
  - pnpm governance:check
  - pnpm test:micro-specs
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm qa:background-workers
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-integrations-whatsapp-dispatch-fallback — WhatsApp-first dispatch with exactly-once SMS fallback

## 1. Exact Goal and User-Visible Outcomes

Guests who explicitly choose WhatsApp receive booking confirmation, update, guest-cancellation,
and restaurant-cancellation messages from the registered Nabatable WhatsApp sender, identifying
the venue inside the approved template. Ineligible or failed WhatsApp delivery falls back to SMS
once, while delivered/read WhatsApp never produces a duplicate SMS.

## 2. Blast Radius

In scope: channel router, Twilio WhatsApp request/response parsing, environment contracts, approved template mapping,
booking mobile-message dispatch, signed WhatsApp status callback, reconciliation, fallback
classification, and focused tests. Out of scope: database DDL, consent UI, manager summaries,
per-venue senders, two-way chat, marketing messages, and email behavior.

## 3. Strict Constraints and Assumptions

- The static sender display name is `Nabatable`; content identifies `<Venue> via Nabatable`.
- Business-initiated messages use configured approved Content SIDs and typed variables.
- Webhook signatures, payload limits, PII redaction, and stable error responses match existing
  Twilio webhook security.
- Provider-accepted messages are reconciled before any stale decision; timeout alone is not a
  fallback trigger.
- Database claims are the authority for idempotency.

## 4. Decisions Already Made

- Eligibility requires valid consent for the current normalized phone, configured WhatsApp
  sender/templates, and a supported recipient.
- No eligibility means direct SMS without a WhatsApp request.
- Any pre-acceptance WhatsApp provider failure falls back immediately to SMS once.
- After provider acceptance, only terminal `failed` or `undelivered` status permits fallback.
- `delivered` and WhatsApp `read` are successful terminal states.
- Unknown or delayed status is reconciled and does not cause blind SMS fallback.

## 5. Behavioral Requirements (EARS)

- WHEN an eligible booking notification is dispatched, THE router SHALL claim the logical
  notification and send its approved WhatsApp template before considering SMS.
- IF WhatsApp is ineligible, THEN THE router SHALL claim and send the SMS attempt directly.
- IF WhatsApp fails before returning a provider message identifier, THEN THE router SHALL claim
  and send one SMS fallback.
- WHILE WhatsApp is accepted, queued, sent, or delivered, THE router SHALL NOT send SMS.
- WHEN a valid signed callback reports `failed` or `undelivered`, THE callback SHALL update the
  attempt and dispatch the atomically claimed SMS fallback.
- WHEN a valid signed callback reports `delivered` or `read`, THE callback SHALL record success
  and SHALL NOT claim SMS.
- IF a callback is duplicated or arrives out of order, THEN THE system SHALL preserve monotonic
  status and SHALL NOT duplicate fallback.
- IF a callback signature or linkage is invalid, THEN THE route SHALL reject it without writing
  notification state.
- WHEN reconciling a stale provider attempt, THE system SHALL fetch by provider message ID and
  apply the same monotonic transition and fallback rules.
- THE system SHALL redact recipient phone data from logs, analytics, and thrown messages.

## 6. Verification Criteria and Task Breakdown

Verification must prove eligible WhatsApp dispatch, direct-SMS ineligibility, pre-acceptance
failure fallback, post-acceptance terminal fallback, delivered/read suppression, duplicated and
out-of-order callback safety, invalid signature rejection, reconciliation, all four booking
message types, and PII-safe observability. Implement one behavior at a time: provider request;
eligibility/router; confirmation integration; update/cancellation integration; callback;
reconciliation; negative/security tests.
