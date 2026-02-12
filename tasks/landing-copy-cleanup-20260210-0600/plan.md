---
task: landing-copy-cleanup
timestamp_utc: 2026-02-10T06:00:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Landing Copy Cleanup

## Objective

Remove integration and payment-related marketing messaging and switch confirmations messaging from SMS to email in the public landing page.

## Success Criteria

- [ ] "Integrated with your stack" section is removed from the public landing page UI.
- [ ] "SMS confirmations" wording is replaced with "email confirmations".
- [ ] Deposit / card pre-auth / Stripe references are removed from the public landing page copy.
- [ ] App builds and the public landing route renders without errors.

## Changes

- Edit `src/components/landing/sections/HeroSection.tsx` to remove the integrations section.
- Edit `src/components/landing/sections/BenefitsSection.tsx` to:
  - Replace SMS confirmations with email confirmations.
  - Remove deposit / card pre-auth bullet.
- Edit `src/components/landing/sections/TestimonialsSection.tsx` to:
  - Add more reviews (expand to 8).
  - Remove reviewer identities and show only the restaurant name.
- Edit `src/components/landing/sections/FAQSection.tsx` to replace broken HTML entities (`&apos;`, `&quot;`) with proper copy.

## Testing Strategy

- `pnpm -s test` (or project equivalent) if available.
- `pnpm -s lint` if available.

## Verification

- Manual UI QA using Chrome DevTools MCP on the public landing page route.
- Capture a screenshot artifact.
