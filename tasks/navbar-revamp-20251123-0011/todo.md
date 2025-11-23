---
task: navbar-revamp
timestamp_utc: 2025-11-23T00:11:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm reuse of existing Shadcn primitives; no new deps needed.
- [x] Note assumptions/deviations in this task folder.

## Core

- [x] Refactor `components/Header.tsx` layout for mobile-first structure (brand + menu trigger primary).
- [x] Simplify/modernize desktop nav styling and active states.
- [x] Keep account data hooks and sign-out flow intact.

## UI/UX

- [x] Redesign mobile drawer grouping (explore links, account actions, CTA) with large touch targets.
- [x] Preserve/verify skip link, focus-visible rings, aria-current/expanded semantics.
- [x] Ensure sticky header with backdrop blur remains performant and legible.

## Tests

- [ ] Keyboard navigation across skip link, nav links, dropdown, and drawer.
- [ ] Mobile viewport check: drawer open/close, link tap targets, focus trap sanity.
- [ ] Desktop viewport check: active states, hover/focus, sign-out still redirects home.

## Notes

- Assumptions: Keep same primary routes (Browse, Reserve) and account destinations.
- Deviations: None yet.

## Batched Questions

- Do we want additional marketing/help links in the nav? (pending guidance)
