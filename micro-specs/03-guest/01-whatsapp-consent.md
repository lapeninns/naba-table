---
spec_id: MS-guest-whatsapp-consent
status: active
risk_class: customer-pii
owner: codex
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/03-guest/**
  - reserve/features/reservations/wizard/**
  - reserve/entities/reservation/**
  - server/booking/**
  - server/bookings/create-completion.ts
  - server/bookings/bookings-post-response.ts
  - server/bookings/request-validation.ts
  - src/app/api/bookings/**
  - src/app/api/ops/bookings/**
  - tests/reserve/**
  - tests/hooks/useCreateReservation.test.tsx
  - tests/server/public-bookings-route.test.ts
  - tests/server/ops-bookings-create-route.test.ts
  - tests/server/booking-whatsapp-consent.test.ts
  - tests/server/booking-create-request-payload.test.ts
  - tests/server/booking-request-validation.test.ts
  - tests/server/booking-create-completion.test.ts
  - tests/e2e/guest-reserve-routes.spec.ts
implementation_surfaces:
  - reserve/features/reservations/wizard/**
  - reserve/entities/reservation/**
  - server/booking/**
  - server/bookings/create-completion.ts
  - server/bookings/bookings-post-response.ts
  - server/bookings/request-validation.ts
  - src/app/api/bookings/**
  - src/app/api/ops/bookings/**
  - tests/reserve/**
  - tests/hooks/useCreateReservation.test.tsx
  - tests/server/public-bookings-route.test.ts
  - tests/server/ops-bookings-create-route.test.ts
  - tests/server/booking-whatsapp-consent.test.ts
  - tests/server/booking-create-request-payload.test.ts
  - tests/server/booking-request-validation.test.ts
  - tests/server/booking-create-completion.test.ts
  - tests/e2e/guest-reserve-routes.spec.ts
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

# MS-guest-whatsapp-consent — Explicit WhatsApp consent for guest and staff booking forms

## 1. Exact Goal and User-Visible Outcomes

Guests can explicitly choose WhatsApp for transactional booking messages in the public Reserve
form, and staff can record the same explicit agreement for an ops-created telephone booking.
Both choices are unchecked by default, clearly name Nabatable and the venue, explain SMS fallback,
and remain tied to the exact phone number confirmed.

## 2. Blast Radius

In scope: Reserve customer and ops modes, booking request schemas and payloads, booking creation
and update persistence, review summaries, analytics-safe state, and focused route/component tests.
Out of scope: provider dispatch, webhook handling, database DDL, previous-booking consent reuse,
marketing consent, and shared primitive changes.

## 3. Strict Constraints and Assumptions

- Reuse the existing Checkbox/Form primitives and Reserve visual system.
- Consent is optional, explicit, unchecked, versioned, and transactional only.
- Public source is `guest_reserve`; ops source is `ops_staff` and records the authenticated actor.
- Consent values never enter PostHog payloads or logs.
- A phone change clears the preference before submission.

## 4. Decisions Already Made

- Guest label: `Use WhatsApp for my booking updates`.
- Guest description: `You confirm this number uses WhatsApp and agree to receive booking messages
from Nabatable on behalf of <Venue>. If WhatsApp is unavailable, we'll send an SMS instead.`
- Staff label: `Guest agreed to WhatsApp booking updates`.
- Review copy is `WhatsApp preferred · SMS backup` when selected and `SMS` otherwise.
- Consent is per booking and cannot be inferred from remembered details, customer history, or
  `marketingOptIn`.

## 5. Behavioral Requirements (EARS)

- THE public WhatsApp preference SHALL be unchecked when a booking form starts.
- THE ops WhatsApp preference SHALL be unchecked when a staff booking form starts.
- WHEN the guest selects WhatsApp, THE form SHALL record explicit consent for the current phone
  and display `WhatsApp preferred · SMS backup` in review.
- WHEN staff select WhatsApp, THE request SHALL include `ops_staff` consent and the server SHALL
  attribute it to the authenticated actor.
- IF the phone changes after consent, THEN THE form SHALL clear consent and require reconfirmation.
- IF WhatsApp remains unchecked, THEN THE request SHALL persist no valid WhatsApp consent.
- IF a public request claims an ops consent source or actor, THEN THE API SHALL reject or discard
  those privileged fields.
- WHEN a booking is updated with a different phone, THE server SHALL invalidate any previous
  WhatsApp consent unless the new request explicitly reconfirms it.
- THE consent interaction SHALL be keyboard accessible and expose its full label and description
  to assistive technology.

## 6. Verification Criteria and Task Breakdown

Verification must prove unchecked defaults, guest copy with venue identity, staff copy, review
summary, phone-change reset, public/ops payload distinction, authenticated actor attribution,
update invalidation, PII-safe analytics, keyboard interaction, and real shipped-route behavior at
375px and 768px. Implement vertically through schema/state, guest form, guest API, ops form, ops
API, update behavior, and browser proof.
