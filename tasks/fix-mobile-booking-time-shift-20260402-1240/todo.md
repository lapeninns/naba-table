---
task: fix-mobile-booking-time-shift
timestamp_utc: 2026-04-02T12:40:07Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Reviewed root + closest AGENTS files for `src/components`, `src/guest`, and `src/app`.
- [x] Confirmed this is a regression fix and documented the verification-first approach in task artifacts.

## Core

- [x] Trace the admin edit flow and guest bookings list rendering path.
- [x] Add a shared timezone-safe booking datetime normalizer.
- [x] Normalize `/api/bookings` guest list responses to return absolute ISO timestamps consistently.
- [x] Replace device-dependent parsing in `BookingListClient`.
- [x] Reuse the same parsing path for upcoming/past classification and sorting.
- [x] Update guest dashboard live/upcoming derivations and rendering to use the shared parser.
- [x] Update guest receipt and reservation detail rendering to use venue-local formatting rules.
- [x] Update reservation adapter fallback ISO synthesis to use the restaurant timezone.
- [x] Standardize shared date-only/time-only utilities so ops date pickers, labels, and time ranges do not depend on the browser timezone.
- [x] Update ops dashboard date shifting and calendar range helpers to use date-key math instead of local `Date` midnight math.
- [x] Update ops dashboard DTO fallback ISO synthesis to derive midnight in the restaurant timezone.
- [x] Update booking validation fallback ISO synthesis to use the restaurant timezone when `start_at` is missing.
- [x] Update assignment-context window computation and response shape to carry the restaurant timezone.
- [x] Update table-assignment panel timeline parsing to interpret ISO window values in the restaurant timezone.
- [x] Update ops floor-plan date/timestamp derivation and time labels to use the restaurant timezone.

## UI/UX

- [x] Keep the existing list card layout and interactions unchanged.
- [x] Preserve the same month/day/time visual treatment while correcting the displayed values.
- [x] Preserve ops dashboard/floor-plan visuals while removing device-timezone drift from date and time labels.

## Tests

- [x] Add focused component coverage for UTC ISO -> venue-local display.
- [x] Add coverage for venue-local timestamp strings without explicit offsets.
- [x] Add unit coverage for shared booking datetime normalization.
- [x] Add unit coverage for reservation adapter timezone fallback.
- [x] Add unit coverage for guest dashboard derivation ordering with venue-local timestamps.
- [x] Add unit coverage for shared date-only/time-only utilities.
- [x] Add unit coverage for ops dashboard date-range math.
- [x] Add unit coverage for ops dashboard DTO fallback ISO synthesis in a non-UTC restaurant timezone.
- [x] Add a dev-only guest bookings harness because `/guest/bookings` redirects to sign-in in local dev.
- [x] Run focused automated tests.
- [x] Run Chrome DevTools mobile verification.

## Notes

- Assumptions:
  - The original reported issue surfaced on a guest mobile surface, but the same normalization rules should apply repo-wide anywhere booking date/time values are displayed or synthesized.
- Deviations:
  - Verification-first was used because the first step was identifying whether the one-hour shift came from edit submission, DB normalization, or guest rendering.

## Batched Questions

- None at the moment.
