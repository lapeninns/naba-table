---
task: guest-functionality-audit
timestamp_utc: 2025-12-11T18:09:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report — Guest-Facing Functionality Audit

## Manual QA — Chrome DevTools (MCP)

- Pending — run once UI inspection/testing occurs or document why not feasible.

## Automated Tests

- 2025-12-11 — `pnpm vitest run tests/server/guest/view-models.test.ts tests/server/guest/booking-list-view.test.ts` ✅
  - Confirms guest bookings view-model hydration and bookings list client states still work as expected.

## Findings

- ✅ Booking list + dashboard wiring rely on `useGuestBookings`/`useGuestProfile` and still hydrate correctly (see passing Vitest suites and `src/components/features/booking/list/BookingListClient.tsx`).
- ✅ Removed the placeholder QR UI from both `src/components/features/guest/dashboard/GuestDashboardClient.tsx` and `src/components/features/booking/detail/ReservationDetailClient.tsx`; confirmation codes now render inline text only and the unused `QRCodeDialogLazy`/`QRCodePanel` implementations were deleted.
- ✅ `GuestProfileClient` now hydrates via `useGuestProfile`, validates via `coerceProfileUpdatePayload`, and submits through `useUpdateProfile`, giving proper success/error handling and disabling the CTA when pristine/pending.
- ✅ Removed the inert communication preference toggles and delete-account button so no dead actions remain on the profile page.

## Artifacts

- `artifacts/` — add Lighthouse/HAR/test logs if/when UI QA is run.

## Known Issues

- Manual Chrome DevTools MCP pass still pending (UI churn limited to deterministic refactors; confirm later if required).
