---
task: guest-recover-save-error
timestamp_utc: 2026-01-20T16:05:16Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest booking recovery save error

## Requirements

- Functional:
  - Guest visiting /bookings/recover?access_token=...&next=/bookings/<id> can edit and save booking changes without hitting a global error page.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve session recovery security model; avoid leaking tokens.
  - Maintain existing error payload conventions for API routes.

## Existing Patterns & Reuse

- Session recovery token handling in `src/app/(public)/bookings/recover/route.ts` and `src/app/api/bookings/[id]/route.ts`.
- Booking page guard logic in `src/app/(public)/bookings/booking-page.tsx`.
- Recovery token is stored in `sr_access` cookie with optional `domain` derived from `NEXT_PUBLIC_ROOT_DOMAIN`.

## External Resources

- N/A

## Constraints & Risks

- Must follow AGENTS SDLC phases; UI changes require Chrome DevTools MCP QA.
- Risk: breaking guest access if token handling changes.
- Risk: cookie `domain` mis-scope can prevent `sr_access` from being set on non-root hosts (previews/custom domains).

## Open Questions (owner, due)

- Q: Which API route is used when saving booking changes from the guest booking page?
  A: `PUT /api/bookings/[id]` via `useUpdateBooking`.
- Q: What exact error/status triggers the "Something went wrong" page?
  A: Likely missing session recovery cookie leading to 401/redirect in client fetch (UNCONFIRMED).

## Recommended Direction (with rationale)

- Ensure `sr_access` cookie domain is only set when the current host matches the configured root domain (normalize `www.`), so recovery cookies are not dropped on previews/custom domains.
