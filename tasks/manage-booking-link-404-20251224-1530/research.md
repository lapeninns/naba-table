---
task: manage-booking-link-404
timestamp_utc: 2025-12-24T15:30:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Manage booking link returns 404

## Requirements

- Functional: Guest manage link from email should load booking detail when visiting `/bookings/{id}?token=...` without requiring auth.
- Non-functional: Maintain current security checks (token bound to booking id, expiry, used tokens allowed for view), keep PII limited in response; ensure URL works on public host.

## Existing Patterns & Reuse

- Token-based access implemented in `src/app/api/bookings/[id]/route.ts` (GET with `token` query) and validated via `validateConfirmationToken()` with 30-day expiry.
- Manage links in emails built in `server/emails/bookings.ts` using `bookingSiteUrl` + `booking.confirmation_token`.
- Public booking page at `src/app/(public)/bookings/[bookingId]/page.tsx` fetches `/api/bookings/{id}` with `token` query if present.

## External Resources

- None yet.

## Constraints & Risks

- Tokens may be missing/expired or misaligned with host; need to avoid exposing PII when token invalid.
- Domain mismatch (`NEXT_PUBLIC_SITE_URL` vs deployed host) could yield 404 if pointing to different environment.
- Supabase remote-only per policy; avoid migrations unless necessary (unlikely here).

## Open Questions (owner, due)

- Do failing links share the correct domain/environment? (owner: eng, due: before fix)
- Does the affected booking row have `confirmation_token` populated and unexpired? (owner: eng, due: before fix)
- Any middleware/rewrites affecting `/bookings/:id` paths in production? (owner: eng, due: before fix)

## Recommended Direction (with rationale)

- Inspect API handler and booking data: confirm token validation path and error codes; reproduce with a sample booking.
- Verify email link construction uses correct base URL and includes token; adjust if environment mismatch is confirmed.
- If token missing/expired on stored booking, ensure creation flow always persists confirmation_token and avoid clearing it in updates.
