---
task: contact-sales-page
timestamp_utc: 2026-03-23T13:58:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Add sales contact page

## Objective

We will add a real public `/contact` page with the provided sales email and phone number so every existing `Contact Sales` link lands on a useful contact destination.

## Success Criteria

- [ ] `/contact` renders a public marketing page.
- [ ] The page shows `amanshresthaaaaa@gmail.com`.
- [ ] The page shows `07467586751`.
- [ ] Structured data and sitemap include the updated contact information/route.

## Architecture & Components

- Shared contact constants: `config/sales-contact.ts`
- Marketing route: `src/app/(public)/(marketing)/contact/page.tsx`
- SEO metadata: `src/components/landing/seo/SchemaOrg.tsx`
- Crawlability: `src/app/sitemap.ts`

## Testing Strategy

- Type and lint checks on touched files.
- Manual browser verification of `/contact` in Chrome DevTools.

## Rollout

- No feature flag.
- Ship directly on the existing marketing route tree.
