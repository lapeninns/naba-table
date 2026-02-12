---
task: guest-ui-polish
timestamp_utc: 2026-02-12T17:30:00Z
owner: github:@amanshresthaa
risk: medium
---

# Implementation Plan: Guest-Facing UI/UX Polish

## Objective

We will unify and polish all guest-facing pages so that every screen—from sign-in to booking detail—shares consistent typography, color tokens, spacing, animations, empty/error/loading states, and mobile UX quality.

## Success Criteria

- [ ] Zero hardcoded `blue-*` / `slate-*` in guest-facing components (use semantic tokens)
- [ ] All pages use heading-hero/page/section/subsection + text-body-warm typography system
- [ ] Consistent terminology: "reservations" as primary noun
- [ ] All pages have loading/error/empty states using shared primitives
- [ ] Footer matches navbar polish level (glass, tokens, expanded content)
- [ ] /bookings landing page uses guest page pattern (hero + gradient + animations)
- [ ] Build passes with no new TypeScript errors
- [ ] Mobile touch targets ≥44px

## Architecture & Batch Plan

### Batch 1: Foundation (CSS + Shared Components)

- Add missing semantic token utility classes in guest-enhanced.css
- Tokenize GuestPrimitives.tsx (replace slate/blue → semantic tokens)
- Tokenize BookingComponents.tsx (toneClasses → semantic tokens)
- Normalize rounding scale (cards: rounded-2xl, tiles: rounded-xl, pills: rounded-full)

### Batch 2: Footer + Bookings Landing

- Polish Footer.tsx (glass effect, tokens, expanded links, responsive)
- Rewrite /bookings/page.tsx with guest page pattern

### Batch 3: Dashboard + Bookings List

- Dashboard: tokenize, fix empty state, link restaurant name
- Bookings List: fix terminology, unify empty states, fix kebab size

### Batch 4: Profile + Sign In + Booking Detail

- Profile: add loading/error/success states, tokenize
- Sign In: use guest typography, tokenize, use shared error component
- Booking Detail: align shell with layout, fix loading skeleton

## Testing Strategy

- TypeScript: `pnpm run typecheck`
- Lint: `pnpm run lint`
- Visual: Chrome DevTools MCP (required for UI changes)

## Rollout

- Single branch, one PR
- All changes are CSS/component-level, no API/data changes
