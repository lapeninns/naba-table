---
task: multipage-landing
timestamp_utc: 2025-12-11T12:30:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Multipage Guest Landing

## Objective

Expose the guest marketing experience as a multi-page flow by using `GuestLandingPage` for `/` and adding dedicated informational pages (e.g. how it works, trust & safety) that reuse existing marketing components and copy.

## Architecture & Routes

- Keep existing auth check and redirect to `/guest/dashboard` in `src/app/(public)/page.tsx`.
- Change the unauthenticated render path to:
  - Wrap content in `MarketingLayout` with default navbar/footer.
  - Render `GuestLandingPage` from `components/marketing` as the main content.
- Add new public marketing routes under `src/app/(public)/(marketing)/`:
  - `/how-it-works` — expanded explanation of the booking flow.
  - `/trust-and-safety` — why the system is trustworthy (consistency, accessibility, security cues).

## Components & Reuse

- Extend `components/marketing/GuestLandingPage.tsx` to export section components (hero, how-it-works, FAQ, CTA) for reuse in the new pages.
- Within the landing page, add small "Learn more" CTAs that link to the new routes (e.g. from the how-it-works section).
- Keep styling aligned with `DesignSystem.md` and reuse Shadcn UI primitives from `components/ui`.

## Testing & Verification

- Ensure typecheck and lint pass: `pnpm typecheck`, `pnpm lint`.
- Run unit tests via `pnpm test` to confirm no regressions.
- Manually verify (locally) that `/`, `/how-it-works`, and `/trust-and-safety` render with correct layout and keyboard navigation (documented later in `verification.md`).
