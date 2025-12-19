---
task: guest-shadcn-refactor
timestamp_utc: 2025-12-04T14:05:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest UI Shadcn Re-base

## Requirements

- Functional:
  - Reimplement guest-facing surface components on top of Shadcn primitives plus minimal custom wrappers.
  - Preserve existing flows and routing for guest pages: `/`, `/restaurants`, `/restaurants/[slug]/*`, `/auth/signin`, `/bookings/[bookingId]`, `/guest/**`.
  - Keep all logic (auth, data loading, query prefetch, redirect rules) intact while changing presentation layer.
- Non-functional (a11y, perf, security, i18n):
  - Maintain WCAG/WAI-ARIA compliance: focus states, keyboard/screen-reader support, aria-live for status messages, semantic landmarks.
  - Perf: avoid CLS; keep lightweight hydration; reuse existing code-split (dynamic import) for wizard and dialogs.
  - Security: no secrets in client; respect CSRF/auth redirect logic; do not weaken guarding.
  - i18n: text currently static; keep strings centralized where possible (no regression).

## Existing Patterns & Reuse

- Shadcn primitives already available under `components/ui`: `button`, `card`, `tabs`, `dropdown-menu`, `badge`, `form`, `input`, `dialog`, `sheet`, `avatar`, `alert`, `alert-dialog`, `skeleton`, etc.
- Layout shells:
  - `components/layouts/MarketingLayout.tsx` and `components/layouts/GuestLayout.tsx` wrap most guest/public pages.
  - `components/customer/navigation/CustomerNavbar.tsx` provides nav for guest layout.
- Feature components to be re-based:
  - Marketing/Home: `src/app/(public)/page.tsx`.
  - Restaurants listing/detail and booking entry: `src/app/(public)/(marketing)/restaurants/**` plus `ReservationWizardClient`.
  - Guest auth: `components/auth/GuestSignInForm.tsx`.
  - Booking detail/list: `ReservationDetailClient`, `BookingListClient`, booking thank-you pages.
  - Guest dashboard: `GuestDashboardClient`.
  - Profile: `components/profile/ProfileManageForm.tsx`.
  - Shared guest empty/error states in `src/components/guest/shared`.
- Data & hooks stay as-is (`useBookings`, `useProfile`, `useReservation`, Supabase session hooks).

## External Resources

- Shadcn UI patterns (local primitives) will be used; no external API changes.
- Existing design tokens / Tailwind config for colors and typography.

## Constraints & Risks

- Large surface area; risk of UI regression if component APIs change—must keep prop signatures stable.
- A11y regressions possible if we replace bespoke DOM; must verify focus order and aria-live messages.
- Time: multiple pages; need phased rollout (shared wrappers first, then drop-in replacements).
- Wizard flow is code-split; re-skin must not break lazy loading.

## Open Questions (owner, due)

- Should gradients/brand visuals be preserved or simplified to system defaults? (owner: design, due: before implementation)
- Do we need dark mode parity? (owner: product, due: before shipping)

## Recommended Direction (with rationale)

- Create a small set of guest-specific wrappers that compose existing Shadcn primitives (`Card`, `Badge`, `Button`, `Tabs`, `DropdownMenu`, `Alert`) to match current layouts while standardizing tokens.
- Refactor pages to use wrappers, keeping logic unchanged (data fetching, redirects, Supabase guards).
- Prioritize shared building blocks: nav/header/footer, hero/section card, status/empty states, booking cards/detail cards, profile form sections.
- Do page-by-page swap after wrappers exist to limit churn and enable staged verification.
