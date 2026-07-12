---
spec_id: MS-guest-whatsapp-review-consent
status: active
risk_class: customer-pii
owner: codex
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/03-guest/**
  - reserve/features/reservations/wizard/**
  - reserve/entities/reservation/**
  - server/booking/**
  - server/bookings/create-completion.ts
  - server/bookings/request-validation.ts
  - src/app/api/bookings/**
  - src/app/api/ops/bookings/**
  - tests/reserve/**
  - tests/server/booking-whatsapp-consent.test.ts
  - tests/server/booking-request-validation.test.ts
implementation_surfaces:
  - reserve/features/reservations/wizard/**
  - reserve/entities/reservation/**
  - server/booking/**
  - server/bookings/create-completion.ts
  - server/bookings/request-validation.ts
  - src/app/api/bookings/**
  - src/app/api/ops/bookings/**
  - tests/reserve/**
  - tests/server/booking-whatsapp-consent.test.ts
  - tests/server/booking-request-validation.test.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - not-yet-created
verification_gates:
  - pnpm governance:check
  - pnpm test
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm qa:observability-privacy
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-guest-whatsapp-review-consent — Versioned WhatsApp review consent

## 1. Exact Goal and User-Visible Outcomes

A guest can explicitly opt in to WhatsApp booking messages plus one post-visit review request
under a new consent version, while existing consent remains valid only for lifecycle messages.
The booking flow states the expanded purpose before acceptance and never silently upgrades consent.

## 2. Blast Radius

In scope are Reserve and ops booking consent copy/state, request validation, booking consent
serialization, and focused behavioral tests within the frontmatter paths. Out of scope are the
review scheduler, provider templates, redirect implementation, ledger migration, email behavior,
reminder channels, restaurant settings, and any retroactive change to stored consent evidence.

## 3. Strict Constraints and Assumptions

- Consent remains unchecked by default and bound to the normalized phone snapshot, source,
  timestamp, actor rules, and exact copy version already used by the booking consent boundary.
- Version 1 evidence must continue to authorize only the four lifecycle events: confirmation,
  update, guest cancellation, and restaurant cancellation.
- Version 2 may authorize exactly those four events plus one post-visit review request.
- Booking reminders are not WhatsApp events under either version.
- Existing bookings and version 1 evidence must not be rewritten or inferred as version 2.

## 4. Decisions Already Made

- The single booking WhatsApp preference is expanded with explicit review wording; no second
  checkbox is introduced.
- Version 2 is required for a review request. Version 1 remains sufficient for lifecycle messages.
- Review email consent and delivery continue independently; WhatsApp review is an additional
  channel, not a replacement.
- A phone change invalidates consent and requires fresh acceptance under the displayed version.

## 5. Behavioral Requirements (EARS)

- WHEN version 2 consent is displayed, THE booking form SHALL identify Nabatable, the venue, the
  four lifecycle message purposes, and one post-visit review request before acceptance.
- WHEN a guest or authorized staff member accepts version 2, THE server SHALL persist the exact
  version and normalized phone snapshot using the existing source and actor rules.
- IF stored consent is version 1, THEN THE system SHALL authorize lifecycle WhatsApp events and
  SHALL NOT authorize a review request.
- IF stored consent is version 2 and the phone snapshot still matches, THEN THE system SHALL
  authorize the four lifecycle events and at most one post-visit review request.
- IF the current phone differs from the consent snapshot, THEN THE system SHALL treat all WhatsApp
  events as ineligible until the preference is accepted again.
- THE booking consent model SHALL NOT authorize reminder events over WhatsApp.

## 6. Verification Criteria and Task Breakdown

- Prove fresh public and ops forms are unchecked and name the expanded purpose.
- Prove v1, v2, phone-change, forged-source, and missing-actor boundaries independently.
- Prove lifecycle eligibility is preserved for v1 and review eligibility is exclusive to v2.
- Implement as Red → Green → Refactor slices for copy/state, payload validation, and persistence.
- Record fresh gates with `governance:run-gates --spec MS-guest-whatsapp-review-consent --record`.
