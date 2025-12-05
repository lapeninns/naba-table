---
task: guest-pages-audit
timestamp_utc: 2025-12-03T19:07:59Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Guest-Facing Routes Inventory

## Requirements

- Functional: catalogue all guest-facing routes/pages and label whether they require authentication (protected) or are public (unprotected). Include any meaningful subcategories if needed (e.g., marketing vs booking vs dashboard).
- Non-functional: adhere to AGENTS policy, avoid code changes, keep output source-backed and current as of 2025-12-03.

## Existing Patterns & Reuse

- `route-scanner.js` script at repo root can enumerate Next.js App Router paths.
- `guest-facing-routes.md` already exists in repo; should confirm freshness and reuse structure where helpful.
- Route organization under `src/app/(public)`, `src/app/guest`, and `src/app/app` per `src/app/AGENTS.md`.

## External Resources

- N/A (internal repo inspection only).

## Constraints & Risks

- Definition of "protected" depends on auth enforcement (middleware/layout hooks); risk of misclassifying if enforcement is implicit.
- Must keep scope to listing/categorization; no code edits allowed.

## Open Questions (owner, due)

- Do we treat email-magic-link confirmation pages as protected? (assume unprotected; verify via middleware scan).
- Are preview/dev routes to be excluded? (assume exclude dev-only routes unless clearly guest-facing).

## Recommended Direction (with rationale)

- Run `route-scanner.js` to extract current Next.js routes.
- Inspect auth/middleware (`middleware.ts`, `src/app/guest/layout.tsx`, shared guards/hooks) to understand which paths enforce auth.
- Cross-check with existing `guest-facing-routes.md` to align terminology and fill gaps.
- Produce categorized list (protected vs unprotected; subcategories marketing/auth/booking/dashboard) citing source paths.
