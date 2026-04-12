---
task: site-map-sync-from-reference
timestamp_utc: 2026-04-12T09:32:38Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Site-map sync from reference branch

## Objective

We will port the guest-facing site-map implementation from the reference branch so guests and the team can browse the public route inventory on `/site-map`, while the XML sitemap reuses the same canonical route list.

## Success Criteria

- [ ] `/site-map` exists and renders the categorized guest route inventory.
- [ ] `src/app/sitemap.ts` emits indexed guest pages from the shared catalog instead of a hardcoded list.
- [ ] Footer exposes a working `/site-map` link.

## Architecture & Components

- `src/app/guest-facing-pages.ts`: single source of truth for guest route metadata and sitemap entries.
- `src/app/(public)/(marketing)/site-map/page.tsx`: human-readable directory page using the shared catalog.
- `src/app/sitemap.ts`: maps shared sitemap entries to absolute URLs.
- `src/components/layouts/Footer.tsx`: exposes `/site-map` and other valid support links.

## Data Flow & API Contracts

- No API changes.
- Route metadata is static in-process data imported by both the page and the sitemap generator.

## UI/UX States

- Loading: none required for static server-rendered page.
- Success: categorized page cards and jump navigation render.
- Error: falls back to framework-level route error handling if import/render fails.

## Edge Cases

- Dynamic route patterns should appear on `/site-map` but not be emitted to the XML sitemap unless they are safe indexed static pages.
- Placeholder or deprecated helper routes should stay labeled as redirects/aliases, not primary pages.

## Testing Strategy

- TypeScript check for compile safety.
- Browser verification for `/site-map` and `/sitemap.xml`.

## Rollout

- No feature flag required.
- Low-risk direct merge once verified locally.

## DB Change Plan (if applicable)

- Not applicable.
