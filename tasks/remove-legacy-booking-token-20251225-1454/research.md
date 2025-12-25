---
task: remove-legacy-booking-token
timestamp_utc: 2025-12-25T14:54:29Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Remove legacy booking token usage

## Requirements

- Functional:
  - Remove legacy `token` query usage for booking detail/management flows.
  - Require session recovery access tokens (`sr1...`) and `sr_access` cookie for guest access.
  - Update any links that still emit `?token=` to use the access-token recovery flow.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve authz boundaries; avoid token leakage in URLs.
  - Maintain user-friendly error paths when legacy tokens are used.

## Existing Patterns & Reuse

- Session recovery token utilities: `server/security/session-recovery-access-token.ts`.
- Token capture + cookie: `src/app/(public)/bookings/recover/route.ts` sets `sr_access`.
- Booking detail currently accepts legacy `token` and access-token cookies.

## External Resources

- Next.js cookies API and recommended options (Context7: `/vercel/next.js`, cookies docs) — confirms server-side cookie access/mutation patterns.

## Constraints & Risks

- Legacy links containing `?token=` will stop working; need a clear error/redirect path.
- Ensure confirmation-token flows for booking confirmation remain intact unless explicitly removed.

## Open Questions (owner, due)

- Q: Should legacy `token` links return an explicit deprecation error vs. generic unauthenticated?
  A: Default to explicit deprecation error unless directed otherwise.

## Recommended Direction (with rationale)

- Remove `token` handling from booking detail UI and booking detail API read path, and eliminate client-side propagation of the legacy token. Update email/manage links to always use session recovery access tokens. This enforces the new flow and prevents continued exposure of legacy tokens in URLs while keeping booking confirmation token usage separate.
