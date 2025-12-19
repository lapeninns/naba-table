---
task: guest-functionality-audit
timestamp_utc: 2025-12-11T18:09:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest-Facing Functionality Audit

## Objective

Verify that every guest-facing surface (marketing landing, restaurant discovery + booking, dashboard, bookings list/detail, profile, receipts) behaves as described in `guest-facing-routes.md`, and produce a list of any flows that remain placeholders (e.g., QR code display, profile updates). For this iteration we will explicitly remove the unused QR UI and wire the profile form to the real `/api/profile` mutation so it becomes functional.

## Success Criteria

- [ ] Route inventory reconciled with current code (no missing or orphaned guest pages).
- [ ] Automated or manual validation performed for core flows (booking CRUD, dashboard load, receipts, profile) with findings recorded.
- [ ] Remove the placeholder QR experience from dashboard + booking detail and ensure no references remain.
- [ ] Wire the profile form to the existing profile mutation, remove non-functional toggles/delete button, and confirm success/error feedback.
- [ ] Deliver explicit list of non-functional guest features plus remediation notes (post-removal this should be empty).

## Architecture & Components

- `src/app/(public)` — Marketing + booking entry points; ensure layout wrappers and CTA flows load without errors.
- `src/app/guest/**` — Authenticated guest portal (dashboard, bookings, profile, receipts).
- `src/components/features/guest/**` — Dashboard + profile clients that surface booking data + forms.
- `src/components/features/booking/**` — Booking detail shells and sidebar panels; remove the QR panel/dialog entirely to avoid dead UI.
- `src/guest/hooks` & `src/guest/services` — Data access for bookings/profile (validate whether required mutations exist).

## Data Flow & API Contracts

- Booking detail & dashboard rely on Supabase-backed `useGuestBookings` / `useGuestProfile` hooks returning DTOs defined in `@/guest/services/ports`.
- QR surfaces are not needed; remove the dialogs/buttons so we do not mislead guests.
- Profile form should call the existing `/api/profile` PUT endpoint (via `useUpdateProfile` from `hooks/useProfile`); currently only logs data, so wire it to the mutation and reuse the optimistic updates/toasts in that hook.

## UI/UX States

- Confirm loading/error/empty states render in `GuestDashboardClient`, `GuestBookingsPage`, `ReceiptClient`.
- Profile form should display submission success/error via the shared mutation hook and disable the CTA until fields change.
- Removing QR UI should not leave awkward gaps; show textual confirmation code instead if needed.

## Edge Cases

- Unauthenticated guest hitting `/guest/bookings/[id]/receipt` should be redirected unless token supplied; confirm logic in `page.tsx` and `ReceiptClient`.
- Booking detail with cancelled status should adjust summary messaging.
- Profile form fields should populate defaults even when metadata missing.

## Testing Strategy

- Run targeted Playwright/Vitest suites that cover guest booking flows if feasible (`pnpm run test:e2e -- --grep guest` or `pnpm vitest run guest`).
- For flows without automated tests (profile submit), rely on code inspection and the shared mutation tests.
- Capture evidence in `verification.md` (at minimum log commands + findings; attach artifacts later if UI run occurs).

## Rollout

- No feature flag toggle; after wiring/removals the UI should be production-ready without placeholders.
- Document remediation recommendations linked to relevant components/routes for future implementation tasks.

## DB Change Plan (if applicable)

- Not applicable for the audit (no schema changes expected).
