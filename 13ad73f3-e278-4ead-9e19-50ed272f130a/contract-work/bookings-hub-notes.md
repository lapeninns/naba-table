# Surface: Bookings Hub

## User Actions

- Open `/bookings` and scan the hero plus the two booking-action cards.
- Tap `Browse restaurants` to start a new booking flow via `/restaurants`.
- Tap `View my bookings` to jump into self-service via `/guest/bookings`.
- Tap `Sign in` to authenticate before returning into the bookings journey.

## Assertions To Cover

- Suggested ID: VAL-HUB-001
  - Title: Hub renders the bookings hero and action region copy
  - Behavior: The page shows the `Bookings` eyebrow, `Your Reservations` H1, supporting copy `Book a new table or manage existing reservations.`, and a region named `Booking actions` containing the two action cards.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/page.tsx:17-33` defines the hero plus `aria-label="Booking actions"`; `tests/e2e/guest-public-pages.spec.ts:8-15` already checks the H1 and action links.
- Suggested ID: VAL-HUB-002
  - Title: Start-booking card sends guests to restaurant discovery
  - Behavior: The `Book a table` card keeps its current description and its primary CTA navigates to `/restaurants`.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/page.tsx:35-53` defines the `Book a table` card and `Link href="/restaurants"`.
- Suggested ID: VAL-HUB-003
  - Title: Manage-bookings card exposes both self-service entry paths
  - Behavior: The `Manage bookings` card keeps its current description and shows both `View my bookings` and `Sign in` CTAs at the same time.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/page.tsx:55-80` renders both buttons inside the manage card; `tests/e2e/guest-public-pages.spec.ts:13-15` verifies the two visible action links.
- Suggested ID: VAL-HUB-004
  - Title: Self-service CTA falls through to auth when the guest is signed out
  - Behavior: A signed-out tap on `View my bookings` lands on `/auth/signin` with `redirectedFrom=/guest/bookings`, because the destination page is auth-protected.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/page.tsx:66-72` links to `/guest/bookings`; `src/guest/routes/bookings/view-model.ts:18-20` requires a user and redirects unauthenticated traffic; `tests/e2e/guest-portal-redirects.spec.ts:10,27-33` covers that redirect contract.
- Suggested ID: VAL-HUB-005
  - Title: Sign-in CTA preserves the hub return target
  - Behavior: Tapping `Sign in` from the hub navigates to `/auth/signin?redirectedFrom=/bookings`.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/page.tsx:74-78` hard-codes the sign-in link with `redirectedFrom=/bookings`.
- Suggested ID: VAL-HUB-006
  - Title: Action layout stays mobile-first and expands to two columns on small-plus screens
  - Behavior: On mobile, the cards stack in one column and all three CTA buttons stretch full width with a minimum 44px tap target; from `sm` upward, the cards split into two columns and buttons can shrink to auto width.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/page.tsx:18,30,32,48,68,76` uses `max-w-6xl`, `sm:grid-cols-2`, `w-full`, `min-h-[44px]`, and `sm:w-auto`.

## Edge Cases / Boundaries

- The hub itself is static: there are no loading, empty, or error states on `/bookings`; validation should focus on default render, navigation, and responsive layout.
- `View my bookings` and `Sign in` intentionally do different things: one targets the protected portal route, the other targets sign-in directly with `redirectedFrom=/bookings`.
- Booking recovery is outside this surface; token capture and recovery errors live under `/bookings/recover` rather than on the hub.
- The page copy mixes `Bookings` metadata with a visible `Your Reservations` H1; preserve this wording unless a broader copy pass explicitly changes it.
- Shared guest chrome comes from layout, so assertions should allow for the page to render inside the guest navbar/footer shell rather than as a blank standalone canvas.

## Implementation Clues

- Route source of truth: `src/app/(public)/bookings/page.tsx`.
- Shared shell: `src/app/(public)/bookings/layout.tsx` wraps the hub in `GuestLayout`, and `src/components/layouts/GuestLayout.tsx:12-16` adds the guest navbar, `main` landmark, and footer.
- The hub uses only shared primitives (`next/link`, `lucide-react`, `Button` from `components/ui/button.tsx`) and does not fetch data or branch on session state.
- Existing browser coverage already seeds the contract: `tests/e2e/guest-public-pages.spec.ts` covers the visible links, and `tests/e2e/guest-portal-redirects.spec.ts` covers the signed-out redirect for `/guest/bookings`.
