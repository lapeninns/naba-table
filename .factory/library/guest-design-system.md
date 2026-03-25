# Guest Design System

Guest-facing design goals, tone, and implementation rules for this mission.

---

## North Star

Warm, clear, trustworthy, and consistent across every guest touchpoint.

## Experience Priorities

- warmth over operational density
- clarity over cleverness
- trust over visual noise
- ease over feature exposure
- guidance over exploration

## Guest-System Rules

- Guests should never feel like they are inside an admin product.
- Warmth must come from the system itself: typography, spacing, surfaces, messaging, and feedback.
- Simplicity should feel intentional, not empty or unfinished.
- Do not introduce a new guest shell, page container, form language, or auth treatment without updating the canonical guest primitives first.

## What Must Stay Consistent

- typography
- spacing
- containers
- forms
- buttons
- cards
- badges
- section structure
- empty states
- loading states
- confirmation and error messaging

## Approved Pattern Sources

- guest layouts in `src/components/layouts/*`
- guest primitives in `src/components/guest/ui/*`
- guest-facing feature components under `src/components/features/*`

## Anti-Patterns

- ops-style density on guest pages
- marketing-only hero experimentation leaking into transactional guest flows
- one-off auth styling
- duplicated typography utilities
- competing guest page shells
- ad hoc text/color classes when canonical guest primitives exist
