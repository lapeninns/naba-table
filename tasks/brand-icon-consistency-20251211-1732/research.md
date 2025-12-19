---
task: brand-icon-consistency
timestamp_utc: 2025-12-11T17:32:00Z
owner: github:@factory-droid
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Brand icon consistency

## Requirements

- **Functional**: ensure every surface that renders the Nab a Table brand glyph uses the same visual treatment as the guest header (`SRX` monogram in primary gradient pill linking home).
- **Non-functional**: match DesignSystem typography/radius, keep focus-visible + accessible names, avoid regressions on auth/marketing layouts.

## Existing Patterns & Reuse

- `src/components/layouts/GuestNavbar.tsx` already defines an inline `BrandMark` helper (lines 78-95) that renders the canonical icon with tone-aware text colors.
- `src/components/layouts/AuthNavbar.tsx` uses a simpler `N` square badge (lines 33-48) and deviates from the guest header style.
- `components/owner-marketing/OwnerMarketingNavbar.tsx` renders another bespoke `SRX` circle (lines 39-47) without the gradient pill.
- `src/app/(public)/auth/signin/page.tsx` shows a standalone `UtensilsCrossed` glyph inside the hero (lines 48-72) which acts as the brand icon on auth pages.
- Augment code retrieval query “Identify where the main header icon is defined/used...” (2025-12-11) confirmed these locations and no shared component yet.

## External Resources

- Design system reference (`DesignSystem.md`) — tokens + typography used by headers and pills.

## Constraints & Risks

- Layouts span both `/components` and `src/components`; extracted component must be importable by both without circular deps.
- Tone-aware text colors required in guest nav; new shared component must cover dark/light contexts.
- Need to avoid breaking SSR/Next server components; headers are client components.

## Open Questions (owner, due)

- None — requirement is scoped to matching existing guest header style.

## Recommended Direction (with rationale)

- Extract the existing `BrandMark` JSX into a new shared `BrandBadge` component under `src/components/shared/` (client) with props for `tone`/`size`.
- Replace custom icon blocks in `AuthNavbar`, `OwnerMarketingNavbar`, guest footer(s), and the auth sign-in hero with the shared component to guarantee consistency.
- Keep component accessible (link text, aria-labels) and rely on Tailwind tokens from the existing markup to maintain a11y + styling parity.
