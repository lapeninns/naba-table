---
task: multipage-landing
timestamp_utc: 2025-12-11T12:30:00Z
owner: github:@amankumarshrestha
reviewers: []
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

- [x] Analyze existing landing and marketing components.
- [ ] Update `/` route to render `GuestLandingPage` for unauthenticated users while preserving auth redirect.
- [ ] Export reusable sections from `GuestLandingPage` for multi-page reuse.
- [ ] Add `/how-it-works` and `/trust-and-safety` pages under `src/app/(public)/(marketing)/` using existing marketing components.
- [ ] Wire "Learn more" CTAs from the main landing to new pages.
- [ ] Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` and fix any issues.
