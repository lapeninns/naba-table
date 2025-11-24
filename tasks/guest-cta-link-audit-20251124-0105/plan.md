---
task: guest-cta-link-audit
timestamp_utc: 2025-11-24T01:05:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Guest CTA & Broken Link Audit

## Objective

Enumerate guest-facing CTAs/links and flag any that are broken or point to non-canonical routes.

## Success Criteria

- [ ] List of all CTAs with visible text and destinations for guest-facing pages.
- [ ] Broken or redirected (non-2xx) links identified with repro steps.
- [ ] Findings stored in task folder and summarized for handoff.

## Architecture & Components

- Use existing Next.js app (`src/app`) pages for guest routes.
- Potential helpers: `route-scanner.js` to crawl guest routes; Playwright for headless fetch.

## Data Flow & API Contracts

- Crawl pages via HTTP (local dev server) to collect anchor/button links; issue HEAD/GET to validate status.
- Compare discovered URLs against canonical list in `guest-facing-routes.md`.

## UI/UX States

- N/A (audit only). Ensure pages render with seed data; watch for loading/empty states to avoid false positives.

## Edge Cases

- Auth-protected guest portal pages may redirect; capture destination and status.
- Dynamic slugs (restaurant, booking) need sample IDs/slugs; use fixtures from `restaurant.json` or `floor_plan_code.json` if required.

## Testing Strategy

- Automated link check crawl; manual spot-check of CTA targets on key pages (home, restaurant profile, booking flow, thank-you).

## Rollout

- No code changes. Deliver report; if issues found, create follow-up tasks.

## DB Change Plan (if applicable)

- None.
