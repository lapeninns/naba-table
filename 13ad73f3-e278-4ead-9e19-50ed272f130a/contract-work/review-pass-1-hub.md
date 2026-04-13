# Review Pass 1: Bookings Hub

## Coverage Verdict

- insufficient: the draft covers the hub at a high level, but it collapses multiple distinct behaviors into three broad checks and misses key path/content assertions for the public-to-guest handoff and the exact source-of-truth hub copy/layout.

## Missing Assertions

- Add a signed-in path assertion for `View my bookings`: the contract only covers the signed-out redirect, but the canonical hub also needs coverage that an authenticated guest can go from `/bookings` to `/guest/bookings` without an auth bounce.
- Add an explicit content assertion for both action cards: `Book a table`, `Manage bookings`, their current supporting descriptions, and all three CTAs (`Browse restaurants`, `View my bookings`, `Sign in`) should be asserted directly. Right now VAL-HUB-001/002 can pass while card headings, descriptions, or the secondary `Sign in` CTA drift.

## Weak Assertions To Tighten

- VAL-HUB-001 is too vague for “renders inside the guest shell” and “hero hierarchy.” Tighten it to observable shell chrome and exact hub copy: `Bookings` eyebrow, `Your Reservations` H1, supporting text, and the labeled `Booking actions` region.
- VAL-HUB-002 should verify both the actual hub destination and the auth handoff. As written, it only checks the final signed-out landing; a direct `/auth/signin?redirectedFrom=/guest/bookings` link would still satisfy the assertion even if the `/guest/bookings` destination changed.
- VAL-HUB-003 should replace subjective checks like “readable” and “reachable” with measurable mobile assertions: one-column card stack below `sm`, all three CTAs full-width on mobile, 44px+ tap targets, and no page-level horizontal scroll.

## Suggested Contract Edits

- Split the current hub section into smaller checks:
  - hub shell + exact hero/action-region copy
  - `Book a table` card copy + `/restaurants` destination
  - `Manage bookings` card copy + simultaneous presence of `View my bookings` and `Sign in`
  - signed-out `View my bookings` handoff to `/auth/signin?redirectedFrom=/guest/bookings`
  - signed-in `View my bookings` landing on `/guest/bookings`
  - mobile layout/tap-target validation with explicit no-overflow evidence
- If the area must stay at three IDs, fold the above specifics into the existing IDs so each one names exact text, exact URLs, and measurable responsive behavior instead of screenshots-only observations.

## Evidence

- `src/app/(public)/bookings/page.tsx:20-23` defines the visible hub copy as `Bookings`, `Your Reservations`, and `Book a new table or manage existing reservations.`
- `src/app/(public)/bookings/page.tsx:32-33,40-42,50,60-62,70,78` defines the `Booking actions` region, both card headings/descriptions, and the three CTA endpoints: `/restaurants`, `/guest/bookings`, and `/auth/signin?redirectedFrom=/bookings`.
- `src/app/(public)/bookings/page.tsx:32,48,64,68,76` shows the mobile/desktop layout contract is implementation-specific (`sm:grid-cols-2`, `flex-col`, `sm:flex-row`, `w-full`, `min-h-[44px]`, `sm:w-auto`), so the validation should assert those outcomes directly.
- `src/app/(public)/bookings/layout.tsx:1-4` and `src/components/layouts/GuestLayout.tsx:12-16` show the hub inherits guest chrome through `GuestNavbar`, the shared `main`, and `Footer`, but the current draft does not define observable evidence for that shell requirement.
- `src/guest/routes/bookings/view-model.ts:18-20`, `tests/guest/guest-view-models.test.ts:92-99`, and `tests/e2e/guest-portal-redirects.spec.ts:10,31-33` prove the signed-out `/guest/bookings` redirect contract exists, but they do not cover the signed-in hub path.
- `tests/e2e/guest-public-pages.spec.ts:8-15` only checks two visible links and an outdated `Bookings` H1 expectation, so the draft contract should not rely on current test coverage to protect the hub’s real copy or CTA set.
