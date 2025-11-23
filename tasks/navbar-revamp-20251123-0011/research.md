---
task: navbar-revamp
timestamp_utc: 2025-11-23T00:11:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Navbar Revamp

## Requirements

- Functional: redesign the customer-facing navbar to feel intentional and modern, keep it sticky, and clearly surface primary flows (browse, reserve), account state, and a mobile-first experience with an improved drawer.
- Non-functional (a11y, perf, security, privacy, i18n): maintain WCAG-compliant keyboard/focus behavior (skip link, focus rings, ARIA for menus), responsive/mobile-first layout, minimal CLS/perf impact (lightweight components), avoid leaking auth/session details in UI.

## Existing Patterns & Reuse

- `components/Header.tsx` is the navbar actually used via `MarketingLayout`, `GuestLayout`, and `AuthLayout`; current UX is a basic flex layout with desktop links and a simple mobile dropdown, minimal focus states, and direct Supabase sign-out calls.
- `components/customer/navigation/CustomerNavbar.tsx` implements a richer sticky navbar with Shadcn `DropdownMenu`/`Sheet` patterns but is not wired into layouts; can reuse styling ideas.
- `components/owner-marketing/OwnerMarketingNavbar.tsx` is separate; no shared code required but can inform active state handling and mobile disclosure patterns.

## External Resources

- N/A yet; UX will rely on internal patterns and Shadcn components already in the project.

## Constraints & Risks

- Navbar is shared across marketing and logged-in pages; regressions here affect the entire site experience.
- Must preserve auth behaviors (account snapshot, sign-out flow) and a11y affordances (skip link, aria labels, focus rings) while changing layout.
- Need to ensure mobile drawer remains performant and closes on navigation to avoid stale overlays.

## Open Questions (owner, due)

- Do we need additional links (e.g., Pricing/Help) or just refine existing Browse/Reserve? (owner: assistant, due: during design)

## Recommended Direction (with rationale)

- Retain data + hooks but restructure layout to be mobile-first: compact top bar with clear brand + menu trigger, slide-in drawer with grouped sections, and simplified desktop navigation with better spacing and contrast.
- Use Shadcn components already in use (Sheet, DropdownMenu, Avatar, buttons) to stay consistent while improving hierarchy and CTA prominence.
- Keep skip link and focus-visible styling; ensure aria-current and aria-expanded semantics remain correct.
