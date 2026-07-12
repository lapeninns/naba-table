---
spec_id: MS-integrations-manager-whatsapp-summary
status: active
risk_class: customer-pii
owner: codex
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/05-integrations/**
  - cloudflare/sms-summary-gateway/**
  - server/restaurants/**
  - src/components/features/restaurant-settings/**
  - components/ops/restaurants/**
  - src/services/ops/restaurants.ts
  - server/restaurants/select-fields.ts
  - src/app/api/ops/restaurants/schema.ts
  - src/app/(public)/dev/_mocks/services/devRestaurantService.ts
  - src/app/api/ops/restaurants/**
  - tests/cloudflare/sms-summary-gateway.test.ts
  - tests/components/RestaurantDetailsForm.test.tsx
  - tests/e2e/ops-authenticated-app-host.spec.ts
implementation_surfaces:
  - cloudflare/sms-summary-gateway/**
  - server/restaurants/**
  - src/components/features/restaurant-settings/**
  - components/ops/restaurants/**
  - src/services/ops/restaurants.ts
  - server/restaurants/select-fields.ts
  - src/app/api/ops/restaurants/schema.ts
  - src/app/(public)/dev/_mocks/services/devRestaurantService.ts
  - src/app/api/ops/restaurants/**
  - tests/cloudflare/sms-summary-gateway.test.ts
  - tests/components/RestaurantDetailsForm.test.tsx
  - tests/e2e/ops-authenticated-app-host.spec.ts
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
  - pnpm qa:observability-privacy
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-integrations-manager-whatsapp-summary — WhatsApp-first manager daily summaries with SMS fallback

## 1. Exact Goal and User-Visible Outcomes

Restaurant managers can explicitly enable WhatsApp-first delivery for the existing daily booking
summary. The Cloudflare Worker sends the approved Nabatable WhatsApp template to the consented
manager number and sends one SMS fallback if WhatsApp is unavailable or fails.

## 2. Blast Radius

In scope: restaurant settings fields and validation, manager consent UI, Worker target loading,
WhatsApp template request, SMS fallback, idempotency outcome, and focused tests. Out of scope:
guest booking notifications, provider callback route, schedule changes, per-venue WhatsApp sender,
two-way chat, and unrelated restaurant settings.

## 3. Strict Constraints and Assumptions

- Existing 10:00 local-time scheduling and queue boundaries remain unchanged.
- The manager phone remains E.164 and consent is tied to that exact normalized number.
- The current Durable Object/idempotency key represents the logical daily summary, not a channel.
- Provider and recipient data remain absent from logs and task artifacts.
- Disabling WhatsApp-first returns the summary to the current SMS path.

## 4. Decisions Already Made

- The settings toggle is `Send daily summary via WhatsApp first` and is unchecked by default.
- Supporting copy states that Nabatable sends on behalf of the restaurant and SMS is the fallback.
- Enabling records consent time, version, phone snapshot, and authenticated actor.
- Changing the manager phone disables WhatsApp-first until reconfirmed.
- One logical daily summary may finish through WhatsApp or SMS, never both successful sends by design.

## 5. Behavioral Requirements (EARS)

- THE WhatsApp-first manager setting SHALL be unchecked until an authenticated manager explicitly
  enables it for the current notification phone.
- WHEN the notification phone changes, THE restaurant settings SHALL disable WhatsApp-first and
  require reconfirmation.
- WHEN an eligible daily summary is claimed, THE Worker SHALL send the approved WhatsApp template.
- IF WhatsApp is disabled or consent is invalid, THEN THE Worker SHALL use the existing SMS send.
- IF WhatsApp fails before provider acceptance, THEN THE Worker SHALL send one SMS fallback under
  the existing logical-summary claim.
- IF WhatsApp is accepted, THEN THE Worker SHALL mark the logical summary sent and SHALL NOT also
  send SMS.
- IF finalization fails after either provider accepts a message, THEN THE Worker SHALL preserve the
  current terminal/manual-reconciliation behavior rather than retrying a duplicate send.
- WHEN the same daily summary is delivered to the queue again, THE Worker SHALL return duplicate
  without sending either channel again.

## 6. Verification Criteria and Task Breakdown

Verification must prove settings defaults, authenticated consent attribution, phone-change reset,
WhatsApp success, disabled/direct SMS, WhatsApp failure/SMS fallback, duplicate queue delivery,
post-send finalization failure, dry run, and real app-host settings interaction. Implement settings
contract and UI first, then Worker target shape, channel request, fallback behavior, idempotency
tests, and staging provider proof.
