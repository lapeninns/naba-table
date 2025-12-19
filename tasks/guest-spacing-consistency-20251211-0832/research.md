---
task: guest-spacing-consistency
timestamp_utc: 2025-12-11T08:32:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest Spacing Consistency

## Requirements

- Normalize padding and margin across guest-facing pages (marketing `/`, auth, guest portal) so mobile layouts align with the guest spacing scale defined in the design system.
- Remove redundant per-component paddings that stack on narrow viewports and ensure consistent container widths/section gaps.
- Preserve existing visual hierarchy, typography, and navigation behavior while improving spatial rhythm.

## Non-functional (a11y, perf, security, i18n)

- Maintain focus order and skip links from `GuestNavbar`/`AuthNavbar`; do not hide important affordances behind spacing tweaks.
- Avoid additional DOM wrappers that could hurt performance or cause new CLS; rely on utility classes/custom properties already defined in `globals.css`.
- Keep layout responsive with minimum 24px touch targets and safe-area padding for devices with notches.

## Existing Patterns & Reuse

- `src/app/globals.css` already defines guest spacing tokens (`--guest-space-*`, `--guest-section-gap`, `.guest-page`, `.guest-section`, `.guest-sections`) but none of the layout files apply those classes (confirmed via repo search; `guest-page` appears only in CSS/docs).
- `GuestLayout` currently nests a `container-default` with `px-4 sm:px-6 lg:px-8`, and `AuthLayout` hard-codes `px-4 py-12` on `<main>`, creating inconsistent padding with the navbar/footer shells.
- `GuestNavbar` and `AuthNavbar` each define their own horizontal padding (`px-4 md:px-6` vs `px-5 sm:px-6`) leading to mismatched edges when compared to page content containers.
- The `DesignSystem.md` / guest style guide tasks (e.g., `style-guide-extraction-20251206-1221`) expect a universal `guest-page` container and `guest-section` utilities for each major section.

## External Resources

- Design references from `tasks/style-guide-extraction-20251206-1221/GUEST_STYLE_GUIDE.md` outline the desired 8pt spacing grid and the `.guest-page` pattern for all guest surfaces.
- Existing plan docs (`tasks/guest-pages-revamp-20251209-1703/plan.md`) emphasize refreshing layouts/sections to use design tokens instead of ad-hoc padding.

## Constraints & Risks

- Changing container padding may affect screenshot baselines and Lighthouse metrics; need to validate via Chrome DevTools MCP per policy.
- Guest pages integrate with Supabase auth redirects; ensure layout refactors do not move `ImplicitAuthHandler` or other logic.
- Some landing components (FactoryHomeClient) use the bespoke Factory theme; ensure adjustments there still respect that theme’s tokens or add shims carefully.

## Open Questions (owner, due)

- Do we need to retrofit every landing section with `.guest-section`, or just ensure top-level wrappers use the shared utilities? — Owner: @assistant, due before implementation.

## Recommended Direction (with rationale)

- Introduce a shared `GuestPageContainer` utility (or class application) leveraged by `GuestLayout`, `AuthLayout`, `MarketingLayout`, and navbars to enforce consistent horizontal padding derived from `--guest-section-padding-x`.
- Update key client components (`FactoryHomeClient`, hero/sections) to wrap sections with `.guest-sections` / `.guest-section` classes instead of bespoke `px-*` spacing, ensuring the 8pt rhythm while reducing redundant wrappers.
- Audit mobile-only paddings (e.g., `AuthNavbar` `px-5`, `GuestNavbar` `px-4`) and replace with CSS variables or `safe-area` aware utilities to keep edges aligned with containers on small screens.
