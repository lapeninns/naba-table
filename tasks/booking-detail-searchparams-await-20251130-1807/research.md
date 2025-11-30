---
task: booking-detail-searchparams-await
timestamp_utc: 2025-11-30T18:07:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Booking detail searchParams error

## Requirements

- Functional: Booking detail page at `/bookings/[bookingId]` must render without runtime errors in Next.js 16; token query param remains supported for existing deep links; behavior for missing/invalid token unchanged (redirect logic remains as-is).
- Non-functional: No regressions to booking detail experience (loading/error states), maintain a11y/URL semantics; keep server component compatibility with Next.js App Router.

## Existing Patterns & Reuse

- Next.js 16 treats `searchParams` as a Promise in server components; other routes should be using `await searchParams` before property access. We should mirror that pattern rather than adding custom helpers.
- Page already normalizes `bookingId` and uses `redirect` from Next navigation; we can reuse that structure and only adjust search param handling.

## External Resources

- Next.js message `searchParams is a Promise` (linked in runtime error) indicates required `await` usage; aligns with official guidance in https://nextjs.org/docs/messages/sync-dynamic-apis.

## Constraints & Risks

- Token handling should stay optional; ensure null-safe access after awaiting.
- Minimal change preferred (root rule: keep edits focused); avoid refactors beyond searchParams unwrapping.

## Open Questions (owner, due)

- None identified; scope is a targeted runtime fix. (owner: github:@assistant, due: 2025-11-30)

## Recommended Direction (with rationale)

- Await `searchParams` once near the top of the server component, derive `token` from the resolved object, and continue existing logic. This aligns with Next.js expectations, prevents runtime error, and preserves current behavior for missing tokens.
