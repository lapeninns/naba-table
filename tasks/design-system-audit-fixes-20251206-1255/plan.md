---
task: design-system-audit-fixes
timestamp_utc: 2025-12-06 12:55
owner: github:@amankumarshrestha
---

# Implementation Plan: Design System Audit Fixes

## Objective

Elevate the SajiloReserveX design system to Airbnb-quality standards.
**Phase 1-2**: Completed (Foundation, Colors, Typos, Shadows).
**Phase 3**: Micro-interactions & Progressive Disclosure.

## Success Criteria

- [ ] `pulse-glow` animation available and applied to primary CTAs.
- [ ] Restaurant/Booking cards show detailing on hover (Progressive Disclosure) on Desktop.
- [ ] Mobile experience remains accessible (no hover dependency).

## Components to Update

1. **Globals CSS**:
   - Add `pulse-glow` keyframes.
   - Add `photo-enhance` utility class.
2. **Guest Component Primitives**:
   - Update `GuestButton` or `Button` variants to use pulse on hover? Or just utility class.
   - Update `GuestCard` to support `group` class for hover effects.
3. **Feature Components**:
   - Identify where Restaurant Cards are rendered (likely Landing page or Search results).
   - Apply progressive disclosure pattern.

## Rollout

- Styles first, then Component logic.
