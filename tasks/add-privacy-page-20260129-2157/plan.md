---
task: add-privacy-page
timestamp_utc: 2026-01-29T21:57:28Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Add Privacy Page

## Objective

We will add a public privacy policy page at `/privacy` so builds pass and users can access legal information.

## Success Criteria

- [ ] Build passes without missing privacy route.
- [ ] `/privacy` renders with readable, accessible structure.
- [ ] Page includes contact/support email and effective date.

## Architecture & Components

- New App Router page: `src/app/(public)/(marketing)/privacy/page.tsx`.
- Reuse `MarketingLayout` and guest typography utilities.
- Redirect `/privacy-policy` to `/privacy` for canonical access.

## Data Flow & API Contracts

- None.

## UI/UX States

- Static content only.

## Edge Cases

- Missing support email env → fallback handled by `config/app.config.ts`.

## Testing Strategy

- Build: `pnpm run build`.
- Manual QA (Chrome DevTools MCP): verify headings, keyboard navigation, contrast, responsive layout.

## Rollout

- No feature flag; static page.

## DB Change Plan (if applicable)

- Not applicable.
