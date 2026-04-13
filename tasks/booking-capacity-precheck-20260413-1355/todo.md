---
task: booking-capacity-precheck
timestamp_utc: 2026-04-13T13:55:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: [bookingValidationUnified]
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Replace the shared capacity service stub with real availability logic
- [x] Keep the public booking route on the canonical create path

## Core

- [x] Add a pre-check before booking creation in `POST /api/bookings`
- [x] Return alternative slots for capacity failures
- [x] Map atomic race conflicts to stable guest-facing `409` responses

## UI/UX

- [x] Reuse the public availability alternative-slot response shape

## Tests

- [x] Route test: pre-check failure returns `409` and skips create
- [x] Route test: atomic conflict returns `409` with alternatives

## Notes

- Assumptions:
  - Customer resolution remains ahead of the pre-check to preserve deterministic idempotency behavior.
- Deviations:
  - Verification-first on the current route flow is acceptable because the fix depends on confirming the live branching behavior before adding tests.
  - The direct insert fallback after a missing RPC booking record was left unchanged because this task focused on pre-checking and guest-facing capacity failures.

## Batched Questions

- None.
