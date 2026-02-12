---
task: ops-ui-consistency
timestamp_utc: 2026-02-04T07:40:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops UI Consistency + Performance

## Objective

Standardize ops UI across `/app/*` pages using shared header/toolbar/empty-state patterns while preserving behavior and improving a11y/perf consistency.

## Success Criteria

- [ ] All ops pages use shared `OpsPageHeader` + `OpsPageToolbar` patterns where applicable.
- [ ] `transition-all` removed from ops UI components; explicit transitions only.
- [ ] Inputs use `type="search"`, `name`, `autocomplete="off"`, and focus-visible styles.
- [ ] Lint + typecheck pass; Chrome DevTools MCP QA artifacts captured.

## Architecture & Components

- `src/components/features/ops-shell/patterns/OpsPageHeader.tsx`
- `src/components/features/ops-shell/patterns/OpsPageToolbar.tsx`
- `src/components/features/ops-shell/patterns/OpsEmptyState.tsx`
- `src/components/features/ops-shell/patterns/OpsStatusBadge.tsx` (optional)

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- Loading/empty/error states remain; use shared empty-state where appropriate.

## Edge Cases

- Pages embedded in settings shell should avoid duplicate H1s.
- Preserve URL param sync for list pages.

## Testing Strategy

- Lint + typecheck.
- Manual UI QA via Chrome DevTools MCP on key pages (dashboard, bookings, customers, settings).

## Rollout

- No feature flags; refactor only.
