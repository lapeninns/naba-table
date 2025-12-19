---
task: guest-routes-unification
timestamp_utc: 2025-12-03T19:19:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest Route Unification

## Objective

Unify guest-facing routes under `/guest/**` without redirects, ensure `guest/thank-you` exists, and remove stale 404 references while preserving existing deep links.

## Success Criteria

- [ ] `/guest` serves dashboard content without redirect.
- [ ] `/guest/bookings/:bookingId` renders booking detail (no redirect) while `/bookings/:id` remains functional.
- [ ] `guest/thank-you` confirmed/retained; no orphaned 404 references.
- [ ] Docs updated to reflect new canonical guest routes and protection labels.
- [ ] Deprecated `/auth/forgot-password` removed; links updated to `/auth/signin`.

## Approach

1. Extract shared booking detail page logic into a reusable module.
2. Re-export that module from both `/bookings/:id` and `/guest/bookings/:id` to avoid redirects and keep compatibility.
3. Make `/guest` route render dashboard content by reusing `/guest/dashboard` page exports.
4. Update docs (`guest-facing-routes.md`, task notes) to new canonical paths.
5. Sanity check route tree and basic render paths.

## Testing / Verification

- Manual check: Ensure route scanner shows `/guest/bookings/:bookingId` as page (no redirect), `/guest` page present.
- Spot-check rendering via Next build not run (note pending). Chrome DevTools MCP pending (UI change).

## Rollout

- No feature flags; low-risk content change. Keep legacy `/bookings/:id` path as alias to avoid breakage.
