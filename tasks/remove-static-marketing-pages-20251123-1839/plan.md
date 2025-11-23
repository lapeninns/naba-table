---
task: remove-static-marketing-pages
timestamp_utc: 2025-11-23T18:39:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Remove marketing pages & CTA

## Objective

Eliminate unused marketing pages (/contact, /product, /privacy-policy, /terms) and the console CTA to avoid dead links.

## Success Criteria

- Routes no longer resolve or appear in route list.
- Navbar/footer no longer link to removed pages or `/ops/login`.
- Build passes.

## Steps

1. Delete page folders `src/app/(marketing)/{contact,product,privacy-policy,terms}`.
2. Remove related links + CTA from `OwnerMarketingNavbar` and `OwnerMarketingFooter`.
3. Sweep for remaining references to these paths or `/ops/login`.
4. Remove `/partners` route.
5. Remove marketing landing (`/`) so guests only enter via `/restaurants/:slug/book`.
6. Update guest-facing routes doc to reflect removals and clarify `/item/:slug`.
7. Update task todo/verification; run lint or type check if quick; note QA status.

## Testing Strategy

- Run `pnpm lint` or `pnpm test --filter?` if fast; otherwise document not run.
- Manual route sweep via `route-map.json` or `next` build not needed after deletions; verify with `rg`.

## Rollout

- No feature flags; pure code removal.
