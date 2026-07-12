---
spec_id: MS-ops-mobile-message-delivery
status: active
risk_class: customer-pii
owner: codex
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/02-ops/**
  - types/smsDelivery.ts
  - server/sms/delivery-log.ts
  - server/observability/delivery-reconciler.ts
  - src/app/app/(app)/sms-delivery/**
  - src/app/api/ops/sms-delivery/**
  - src/app/api/ops/bookings/**/sms-delivery/**
  - src/components/features/sms-delivery/**
  - src/components/features/dashboard/booking-details/components/SmsDeliveryPanel.tsx
  - src/components/features/ops-shell/navigation.tsx
  - tests/server/sms-delivery-route.test.ts
  - tests/server/booking-sms-delivery-route.test.ts
  - tests/components/opsSmsDeliveryDomain.test.ts
  - tests/components/opsNavigation.test.ts
implementation_surfaces:
  - types/smsDelivery.ts
  - server/sms/delivery-log.ts
  - server/observability/delivery-reconciler.ts
  - src/app/app/(app)/sms-delivery/**
  - src/app/api/ops/sms-delivery/**
  - src/app/api/ops/bookings/**/sms-delivery/**
  - src/components/features/sms-delivery/**
  - src/components/features/dashboard/booking-details/components/SmsDeliveryPanel.tsx
  - src/components/features/ops-shell/navigation.tsx
  - tests/server/sms-delivery-route.test.ts
  - tests/server/booking-sms-delivery-route.test.ts
  - tests/components/opsSmsDeliveryDomain.test.ts
  - tests/components/opsNavigation.test.ts
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

# MS-ops-mobile-message-delivery — Channel-neutral mobile message delivery observability

## 1. Exact Goal and User-Visible Outcomes

Authorized ops users can see one coherent mobile-message journey for each booking notification,
including the WhatsApp attempt, its terminal state, and any linked SMS fallback, without losing
existing SMS history or exposing more recipient PII.

## 2. Blast Radius

In scope: channel-neutral DTOs, existing delivery feed/read models, `/app/sms-delivery` content,
booking delivery panel, filters/labels, reconciliation visibility, and focused tests. Out of scope:
route renaming, proxy changes, provider dispatch, consent capture, schema changes, email delivery,
and shared UI primitives.

## 3. Strict Constraints and Assumptions

- Keep `/app/sms-delivery` as the stable route while changing its user-facing title to `Message Delivery`.
- Preserve current role and restaurant scoping.
- Continue masking recipient phone data on all ops responses and UI.
- Present attempts as one logical notification, not unrelated rows.
- Reuse existing components and Luma primitives.

## 4. Decisions Already Made

- Channels are `whatsapp` and `sms`; provider remains Twilio for both.
- The primary journey label names the notification type and final outcome.
- A fallback journey reads `WhatsApp failed · SMS delivered` or the corresponding current state.
- Existing SMS-only history appears as an SMS journey without synthetic WhatsApp data.

## 5. Behavioral Requirements (EARS)

- THE ops delivery DTO SHALL identify logical notification, channel, provider attempt, current
  status, fallback relationship, and masked recipient.
- WHEN WhatsApp succeeds, THE UI SHALL show the WhatsApp terminal state with no SMS attempt.
- WHEN SMS follows WhatsApp failure, THE UI SHALL group both attempts in chronological order and
  label the SMS attempt as fallback.
- WHEN history contains SMS-only rows, THE UI SHALL continue to render them without error.
- IF the user lacks current restaurant access, THEN THE API SHALL return no delivery data.
- IF a provider attempt is stale, THEN THE UI SHALL preserve the existing reconciliation warning
  with the correct channel label.
- THE route heading and navigation description SHALL say `Message Delivery` rather than implying
  all attempts are SMS.
- THE UI SHALL remain usable at 375px, 768px, and desktop widths with keyboard-visible controls.

## 6. Verification Criteria and Task Breakdown

Verification must prove DTO sanitization, tenant denial, WhatsApp-only grouping, fallback grouping,
legacy SMS rendering, stale state, filters, labels, and real authenticated app-host interaction at
mobile and desktop widths. Implement DTO/read model first, then route responses, grouping/domain,
booking panel, restaurant feed, copy, and browser proof.
