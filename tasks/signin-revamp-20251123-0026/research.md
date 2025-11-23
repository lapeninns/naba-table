---
task: signin-revamp
timestamp_utc: 2025-11-23T00:26:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Sign-in Revamp

## Requirements

- Functional:
  - Add existing navbar component to `/auth/signin` page for consistent navigation.
  - Refresh sign-in page hero/copy while keeping magic-link and password modes intact.
  - Keep redirectedFrom handling and auth flows unchanged (Supabase OTP/password).
- Non-functional (a11y, perf, security, privacy, i18n):
  - Mobile-first responsive layout; comfortable tap targets; keyboard navigation.
  - Preserve screen-reader labels, focus-visible styles, and ARIA status messaging.
  - No secrets in source; reuse existing analytics events.
  - Keep load light; avoid regressions to current perf budgets.

## Existing Patterns & Reuse

- Navbar: `components/customer/navigation/CustomerNavbar` (also re-exported via `components/marketing/Navbar.tsx`).
- Sign-in form: `components/auth/SignInForm.tsx` uses Shadcn `Card`, `Form`, `Button`, `Input`; supports magic-link/password modes with Supabase client.
- Page layout: `src/app/auth/signin/page.tsx` already uses skip link, gradient background, badge, hero copy, and CTA links.
- Utility: `buttonVariants`, `cn`, analytics helpers already integrated in form.

## External Resources

- None needed; all components are local.

## Constraints & Risks

- Must not alter Supabase auth logic or redirects.
- Need to keep status messaging visible on small screens.
- Navbar is client component; ensure usage is allowed in app route (likely needs client boundary or wrapper).

## Open Questions (owner, due)

- Q: Should navbar use marketing wrapper or direct `CustomerNavbar` import? (Owner: eng; Due: now) — tentative: use `CustomerNavbar` for consistency with app shell.

## Recommended Direction (with rationale)

- Embed `CustomerNavbar` at the top of the sign-in page to keep navigation consistent.
- Simplify hero layout for mobile-first (stacking, reduced padding), keep gradient background but add clearer sections.
- Adjust `SignInForm` spacing and responsiveness (full width, tighter gaps on mobile, maintain Card/inputs) without changing logic.
