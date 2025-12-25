---
task: guest-booking-self-edit
timestamp_utc: 2025-12-25T23:28:37Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest self-edit bookings

## Requirements

- Functional:
  - Guests can edit their own bookings from guest-facing flows when:
    - logged in (session user), or
    - using the manage-booking link (session recovery token).
  - Editable fields: date, time, party size, notes.
  - Existing constraints remain: pending lock grace window, past booking blocking, operating hours, capacity, etc.
- Non-functional (a11y, perf, security, privacy, i18n):
  - a11y: keep dialog keyboard-accessible and focus management intact.
  - security: enforce server-side ownership checks (email/auth_user_id or recovery token match).
  - privacy: no visibility or editing of others' bookings.

## Existing Patterns & Reuse

- Guest booking detail page: `src/app/(public)/bookings/[bookingId]/page.tsx` -> `ReservationDetailClient`.
- Edit dialog: `components/dashboard/EditBookingDialog.tsx` using `useUpdateBooking` (PUT `/api/bookings/:id` with dashboard schema).
- Booking detail API: `src/app/api/bookings/[id]/route.ts` GET enforces ownership via authenticated email or recovery token.
- Booking list API: `src/app/api/bookings/route.ts` `me=1` uses authenticated user email.
- Session recovery token flow: `server/security/session-recovery-access-token.ts`.
- Ownership check pattern: email or `auth_user_id` (see `/api/reservations/[id]/confirmation/route.ts`).

## External Resources

- None identified (internal patterns sufficient).

## Constraints & Risks

- Route handlers are system boundaries; must enforce authz server-side.
- Changes affect guest-facing UI and API; Chrome DevTools MCP QA is mandatory.
- Risk: if ownership check is too permissive, guests could edit others' bookings.

## Open Questions (owner, due)

- Q: Should guest edits be allowed via logged-in user or recovery link?
  A: Yes, either is allowed.
- Q: Should ownership allow `auth_user_id` match in addition to email?
  A: Yes.
- Q: Editable fields?
  A: Date, time, party size, notes.
- Q: Keep pending/past booking blocking?
  A: Yes.
- Q: Feature flag?
  A: No.
- Q: Owner/reviewer for task frontmatter?
  A: Use `github:@maintainers`.

## Recommended Direction (with rationale)

- Reuse the existing dashboard update flow (`dashboardUpdateSchema`) but add guest ownership checks when a user session exists (email match or `auth_user_id` match). This aligns with GET authorization, avoids new UI work, and keeps server-side enforcement.
