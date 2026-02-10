---
task: landing-copy-cleanup
timestamp_utc: 2026-02-10T06:00:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Landing Copy Cleanup

## Requirements

- Functional:
  - Remove the "Integrated with your stack" section completely from the landing experience.
  - In "The Total Lockdown Bundle", replace SMS confirmations with email confirmations.
  - Remove payment-integration related messaging (deposits, card pre-auth, Stripe) from the landing/marketing copy.

- Non-functional:
  - No functional changes to booking/payment systems implied by copy edits.
  - Keep a single canonical copy source for the public landing page.

## Existing Patterns & Reuse

- Landing page uses `src/components/landing/LandingPage.tsx` and sections in `src/components/landing/sections/*`.

## Constraints & Risks

- There are legacy/unused landing components (`src/components/landing/FactoryHomeClient.tsx`) that duplicate copy. We should update canonical paths first and avoid breaking imports.

## Open Questions (owner, due)

- Q: Does "remove payment integration" mean remove product functionality (deposits) or only remove marketing mentions?
  - A: Implementing copy-only changes in this task; product-level removals would be a separate scoped task.

## Recommended Direction

- Update the canonical section components (`HeroSection`, `BenefitsSection`).
- Remove Stripe/Twilio integration list and any deposit/pre-auth bullets from the "Total Lockdown Bundle" list.
