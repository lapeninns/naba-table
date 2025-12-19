---
task: guest-functionality-audit
timestamp_utc: 2025-12-11T18:09:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest-Facing Functionality Audit

## Requirements

- Functional: Audit every guest-facing flow (marketing, booking, dashboard, profile, receipts) to confirm real functionality (QR check-in, booking CRUD, profile updates, favorites, etc.) and enumerate anything that is still placeholder/non-functional.
- Non-functional: Maintain WCAG-compliant UI, avoid regressions to guest routes documented in `guest-facing-routes.md`, and keep mobile performance/responsiveness consistent with `DesignSystem.md` guidance.

## Existing Patterns & Reuse

- Guest layouts and feature components already share the `.guest-theme` shell and `GuestBackground` (see `guest-facing-routes.md`).
- Booking flows rely on feature modules under `src/components/features/booking/**` and hooks/services defined in `src/guest/hooks` and `@reserve/shared/*`.
- QR code dialogs today merely render the Lucide `<QrCode />` icon in `GuestDashboardClient.tsx` and `ReservationDetailClient.tsx` with no actual QR payload.
- Profile management UI in `src/components/features/guest/profile/GuestProfileClient.tsx` uses `react-hook-form` but logs submissions to the console with a `// TODO: Connect to mutation` comment and no persistence.
- Existing Playwright suites such as `tests/e2e/guest/booking-crud.spec.ts` cover booking lifecycle but do not cover QR or profile flows.

## External Resources

- `guest-facing-routes.md` — authoritative list of public + guest routes and their layouts/themes.
- `docs/routes-guest-facing.md` — canonical route map & redirect matrix for guest URLs.

## Constraints & Risks

- Many guest components depend on Supabase auth/session; validating end-to-end may require seeded data or mocks.
- QR dialog surfaces may mislead users because the displayed icon is not scannable.
- Profile update actions are currently inert—submitting the form never persists changes and gives no confirmation/error messaging.
- Need to ensure we do not regress other authenticated flows while inspecting guest components.

## Open Questions (owner, due)

- Q: Do we have a scope for additional guest flows such as favorites or notifications beyond QR + profile? (owner: github:@assistant, due: ASAP)
- Q: Are there backend APIs ready for profile mutations or QR token generation that we should wire up? (owner: github:@assistant, due: ASAP)

## Recommended Direction (with rationale)

- Inventory all guest touchpoints via docs + route inspection, then deep dive into components with known stubs (QR dialog, profile form) to confirm non-functional aspects.
- Review existing hooks/services to see whether the necessary data/mutations exist but are unused; document the gap if backend work is still pending.
- Run targeted automated tests (unit or e2e) for guest flows that are supposed to work today (booking CRUD, receipts) while manually flagging unfinished surfaces so stakeholders can prioritize fixes.
