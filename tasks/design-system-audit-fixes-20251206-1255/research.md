# Research: Design System Audit Fixes - Phase 3

## Requirements

Implement "Enhancement" recommendations: Micro-interactions and Progressive Disclosure.

**Priority 3: Enhancements (Phase 3)**

1. **Micro-interactions**
   - **Pulse Glow**: Add `@keyframes pulse-glow` for primary CTAs on hover.
   - **Hover Lift**: Ensure `.guest-card-interactive` has refined physics (already in Phase 2 tokens, verify usage).

2. **Progressive Disclosure**
   - **Pattern**: Hide complexity until interaction (hover/focus).
   - **Target**: Restaurant Cards (List views).
   - **Implementation**: Use group-hover to reveal secondary info (price, distance, quick view).

3. **Emotional Design**
   - **Warm Accents**: Use the new `accent` (Coral) color for "Special Offers" or "Book Now" highlights.
   - **Photo Treatment**: Slight saturation boost on hover.

## Components to touch

- `src/app/globals.css`: Add animations.
- `src/components/guest/ui`: `GuestCard` potentially.
- `src/components/features/landing`: Landing page list items?
- `src/components/features/booking/list`: Booking list items?

## Constraints

- Progressive disclosure works best on desktop (hover). On mobile, information should likely be visible or toggled via tap. Ensure media queries handle this (visible by default on touch devices).
