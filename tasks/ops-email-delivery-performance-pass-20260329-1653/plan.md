---
task: ops-email-delivery-performance-pass
timestamp_utc: 2026-03-29T16:53:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Email Delivery Performance Pass

## Objective

We will restructure the operator email delivery screen so that query state, data ownership, retry actions, and table rendering are separated into narrower units, reducing rerender scope and repeated render-time work while keeping current operator behavior intact.

## Success Criteria

- [ ] `OpsEmailDeliveryClient.tsx` is materially smaller and focused on composition.
- [ ] Delivery-log table consumes precomputed row/view models instead of deriving from raw attempts during render.
- [ ] Retry actions become key-driven where practical.
- [ ] URL/bookmark behavior, retry flow, pagination, and restaurant switching remain functionally equivalent.
- [ ] Targeted tests, typecheck, lint, and manual DevTools verification pass.

## Scope Boundaries

- In scope:
  - `src/components/features/email-delivery/OpsEmailDeliveryClient.tsx`
  - `src/components/features/email-delivery/components/OpsEmailDeliveryTable.tsx`
  - new email-delivery selectors/types/hooks under `src/components/features/email-delivery/`
  - minimal supporting changes to email-delivery tests and dev harness if required
- Out of scope:
  - production email sending APIs/handlers
  - Cloudflare behavior
  - visual redesign
  - unrelated operator screens

## Architecture & Components

- Introduce an email-delivery query-state hook to own:
  - parsed URL params
  - local editable filter/search state
  - URL synchronization
  - pagination and tab changes
- Introduce an email-delivery data-state hook to own:
  - feed query
  - analytics query
  - derived summary/status counts
  - precomputed table row models and attempt lookup maps
- Introduce a retry/action hook to own:
  - pending retry key
  - retrying key
  - confirm/cancel handlers
- Keep `OpsEmailDeliveryClient` as the narrow composition shell.
- Update `OpsEmailDeliveryTable` to consume view models plus key-driven retry callbacks.

## Contracts / Types To Add Or Consolidate

- Email delivery tab / refresh option shared types.
- Email delivery query-state shape for client composition.
- `OpsEmailDeliveryTableRowViewModel` for precomputed table display and sorting.
- Shared selectors for:
  - building row models
  - deriving attempt lookup maps
  - status count shaping if needed

## Behavior That Must Remain Unchanged

- Current filters, search submit behavior, range changes, pagination, and URL persistence.
- Retry confirmation flow and success/error toasts.
- Queue and analytics tabs remain available with the same operator-facing semantics.
- Restaurant switching still resets state in the current way.
- Existing dev harness route continues to work.

## Testing Strategy

- Add selector/view-model tests for precomputed row shaping.
- Update table tests to use the new row-based contract if needed.
- Run existing targeted email delivery component tests where impacted.
- Run targeted typecheck and lint on touched files.
- Manual Chrome DevTools verification on `/dev/ops-email-delivery`.

## Rollout / Risk / Fallback

- Risk is medium because the page has many intertwined behaviors, but the changes stay inside the operator UI layer.
- No API contract changes are planned.
- If any runtime regressions appear, the fallback is to keep the new selectors/hooks and revert only the table/action integration points in a follow-up patch.
