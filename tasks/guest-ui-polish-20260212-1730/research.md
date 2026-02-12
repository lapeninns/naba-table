---
task: guest-ui-polish
timestamp_utc: 2026-02-12T17:30:00Z
owner: github:@amanshresthaa
risk: medium
---

# Research: Guest-Facing UI/UX Polish

## Requirements

- **Functional**: Full visual consistency across all guest-facing pages (public + authenticated).
- **Non-functional**: a11y (WCAG), mobile-first, prefers-reduced-motion, performance (no CLS, no new re-renders).

## Existing Patterns & Reuse

- **Design tokens**: `guest-enhanced.css` provides surface-warm/elevated/muted, layered shadows, motion variables, typography headings (heading-hero/page/section/subsection), text-body-warm
- **Guest utilities**: `globals.css` provides guest-boundary, stagger-container, animate-fade-in-up, btn-tactile, focus-ring, touch-feedback, card-interactive
- **Shared components**: GuestPrimitives (GuestSection, GuestCard, GuestEmpty, GuestError, GuestStatus, MetricTile, ActionCard), BookingComponents (BookingDetailShell, BookingSummaryCard, DetailStatCard, InfoPanel, InlineAlert, ManageBookingPanel)

## Pages Audited

| Page             | Status          | Key Issues                                                                |
| ---------------- | --------------- | ------------------------------------------------------------------------- |
| Dashboard        | Good foundation | Hardcoded slate/blue, empty state diverges, View details not linked       |
| Bookings List    | Good foundation | "Your Trips" terminology, tab empty states inconsistent, kebab <44px      |
| Booking Detail   | Good foundation | Shell duplicates layout bg/padding, loading skeleton mismatches structure |
| Profile          | Needs work      | No loading/error/success states for mutations, disabled input styling     |
| Sign In          | Needs work      | Not using guest typography utilities, error alert not shared              |
| Bookings Landing | Unfinished      | No hero/gradient, no animations, generic shadcn styling                   |
| Footer           | Quality gap     | Hardcoded colors, no glass/backdrop, minimal content                      |
| Navbar           | Strong          | Minor focus-ring consistency in mobile drawer                             |

## Key Inconsistencies

1. **Hardcoded colors**: 100+ uses of `slate-*`/`blue-*` that should be semantic tokens
2. **Typography systems**: Mix of heading-hero/page/section and raw text-3xl/4xl font-bold
3. **Terminology**: "Trips" vs "Reservations" vs "Bookings"
4. **Empty states**: Some use GuestEmpty, some bespoke Card, some inline text
5. **Layout duplication**: Pages add min-h-screen bg-surface-warm pb-20 on top of GuestLayout
6. **Rounding inconsistency**: Mix of rounded-xl, 2xl, 3xl across same-level components
7. **Footer vs Navbar quality gap**: Footer is plain while navbar is polished

## Recommended Direction

Implement in 4 batches:

1. **Foundation** (CSS tokens + shared components) → cascading fixes
2. **Authenticated pages** (Dashboard, Bookings, Detail, Profile)
3. **Public pages** (Sign In, Bookings Landing)
4. **Layout shell** (Footer, GuestLayout padding)
