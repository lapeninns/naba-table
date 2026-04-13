---
task: fix-phone-only-manage-link
timestamp_utc: 2026-04-13T11:59:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Fix Phone-Only Manage Link

## Requirements

- Functional:
  - Phone-only ops bookings must receive a valid guest "manage your booking" link in SMS.
  - Bookings created with phone plus email must continue to receive a working manage link.
  - Token-authenticated guest booking APIs must accept the same identity shapes the ops flow allows.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve the existing signed session-recovery token security model.
  - Keep guest access bounded to the booking's restaurant and contact identity.
  - Avoid introducing parallel token systems or legacy shims.

## Existing Patterns & Reuse

- `src/app/api/ops/bookings/route.ts` intentionally allows at least one contact method and stores blank `customer_email`/`customer_phone` when the other side is omitted.
- `server/bookings/manage-url.ts` generates guest manage links by creating a signed session-recovery access token.
- `server/security/session-recovery-access-token.ts` currently defines the token payload and validation rules.
- `src/app/api/bookings/route.ts`, `src/app/api/bookings/[id]/route.ts`, `src/app/api/bookings/[id]/history/route.ts`, and `src/app/api/reservations/[id]/confirmation/route.ts` all validate the same token shape before allowing guest access.

## External Resources

- None needed; this is a repo-internal contract mismatch.

## Constraints & Risks

- The bug spans both generation and validation paths, so a partial fix in the SMS layer would still leave phone-only links unusable.
- Any guest-access relaxation must remain restaurant-scoped and contact-scoped.
- This is a regression fix, so verification-first is appropriate before adding tests.

## Open Questions (owner, due)

- Q: Should session-recovery require both email and phone, or at least one contact method?
  A: At least one contact method, to align with ops walk-in booking creation. Owner: github:@amanshresthaa, due: 2026-04-13

## Recommended Direction (with rationale)

- Change the session-recovery token contract from "email + phone required" to "at least one of email or phone required".
- Centralize booking-vs-token contact matching in the session-recovery module so all guest-access endpoints enforce the same rule.
- Keep the manage-link generator on the same canonical session-recovery path instead of introducing a separate phone-only link mechanism.
