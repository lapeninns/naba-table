---
task: contact-sales-page
timestamp_utc: 2026-03-23T13:58:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Research: Add sales contact details to contact page

## Requirements

- Functional:
  - Add the sales email `amanshresthaaaaa@gmail.com`.
  - Add the sales phone `07467586751`.
  - Make the marketing `/contact` destination show those sales details.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Keep contact details centralized so page and structured data stay aligned.
  - No secrets involved; these are public sales contacts.

## Existing Patterns & Reuse

- Marketing legal pages live under `src/app/(public)/(marketing)/`.
- Marketing pages use `MarketingLayout` automatically via `src/app/(public)/(marketing)/layout.tsx`.
- Privacy page styling in `src/app/(public)/(marketing)/privacy/page.tsx` is the closest existing pattern.
- Existing landing links already point to `/contact`, but there is no route file for that path yet.
- Structured contact metadata lives in `src/components/landing/seo/SchemaOrg.tsx`.

## Constraints & Risks

- This is a UI change, so Chrome DevTools verification is required.
- `/contact` is already linked from multiple entry points, so the new page should be minimal and reliable rather than introducing a heavy form flow.

## Recommended Direction (with rationale)

- Create a dedicated `src/app/(public)/(marketing)/contact/page.tsx`.
- Centralize the sales email and phone in a small shared config module.
- Update `SchemaOrg` and sitemap so contact details and crawlable routes stay aligned.
