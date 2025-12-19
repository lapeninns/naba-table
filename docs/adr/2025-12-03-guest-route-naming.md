---
title: Guest route naming unification
status: accepted
date: 2025-12-03
authors: [assistant]
---

## Context

Guest-facing routes had mixed patterns (`/bookings/:id`, `/guest/bookings/:id`, nested `/book/.../thank-you`) and an unused password-reset page. Magic-link is the only supported auth method.

## Decision

- Canonical guest namespace is `/guest/**` for authenticated experiences.
- Booking detail canonical path: `/guest/bookings/:bookingId` (auth-or-token).
- Thank-you/receipt canonical path: `/guest/bookings/:bookingId/receipt`; keep `/bookings/:id/thank-you` as legacy alias (no redirects for now).
- Restaurant confirmation canonicalized to `/restaurants/:slug/thank-you`; keep `/restaurants/:slug/book/thank-you` as legacy alias.
- Remove `/auth/forgot-password`; sign-in remains `/auth/signin` (magic link only).
- Avoid internal redirects within guest namespace; reuse shared components instead.

## Consequences

- Fewer surprise redirects; consistent breadcrumbs and analytics attribution under `/guest/**`.
- Legacy links keep working but should be documented as aliases; future cleanup can add 301s if desired.
- Documentation updated to reflect canonical paths; route scanner artifacts regenerated.

## Follow-ups

- Update analytics to treat `/guest/bookings/:id/receipt` as the primary conversion event.
- When safe, add 301 redirects from legacy confirmations to the canonical receipt path.
- Run Chrome DevTools MCP a11y/perf checks on updated routes (pending).
