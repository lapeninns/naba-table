---
task: multipage-landing
timestamp_utc: 2025-12-11T12:30:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Research: Multipage Guest Landing

- Existing root landing is implemented at `src/app/(public)/page.tsx` using `FactoryHomeClient` inside `MarketingLayout`.
- Guest-focused marketing components live under `src/components/marketing`, with `GuestLandingPage` assembling hero, features, how-it-works, testimonials, FAQ, and CTA.
- `landing-copy-sections.md` defines copy for hero, metrics, trust, how-it-works, discovery, receipts, and CTA bands, which we can map into dedicated informational pages.

- Plan: repoint `/` to use `GuestLandingPage` inside `MarketingLayout` while keeping authenticated redirect, and add new routes under `src/app/(public)/(marketing)/` (e.g. `/how-it-works`, `/trust-and-safety`) that reuse marketing sections for deeper content.
