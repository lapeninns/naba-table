---
task: landing-and-discovery-surfaces
timestamp_utc: 2026-03-25T09:39:00Z
owner: github:@factory-droid
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review mission context, guest system library, and current landing/discovery implementation
- [x] Capture research and implementation plan

## Core

- [ ] Update tests for guest-first landing/discovery behavior (RED)
- [ ] Migrate landing page to canonical guest discovery hierarchy
- [ ] Align restaurant listing/detail sections to guest primitives and explicit CTAs
- [ ] Ensure deterministic discovery empty states remain guest-friendly

## Tests

- [ ] Targeted Vitest / Playwright checks for landing/discovery behavior
- [ ] Run validators (`npx vitest run --maxWorkers=9`, `pnpm typecheck`, `pnpm lint`)
- [ ] Manual browser verification on `/`, `/restaurants`, and `/restaurants/[slug]`

## Notes

- Preserve signed-in root redirect to `/guest/dashboard`.
- Keep route ownership/auth logic centralized; no schema or ops changes.
