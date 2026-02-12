---
task: ops-email-delivery-dashboard
timestamp_utc: 2026-02-06T21:28:53Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Task Setup

- [ ] Ensure task artifacts are present and linked in PR

## DB (Supabase)

- [ ] Add migration: index + RPC feed + RPC summary
- [ ] Ensure safe permissions (no PUBLIC execute; service role only unless policy says otherwise)
- [ ] Add rollback notes + dry-run diff placeholders into `artifacts/`

## Backend

- [ ] Add server wrappers calling `rpc(...)`
- [ ] Update `GET /api/ops/email-delivery` to attempt-based response + page-1 summary
- [ ] Preserve 503 error behavior for delivery log unavailable
- [ ] Retire event-level list function if unused

## Shared Types

- [ ] Add `OpsEmailDeliveryAttemptDTO` and `OpsEmailDeliverySummary`
- [ ] Update `OpsEmailDeliveryFeedResponse` contract

## Client Data

- [ ] Update ops service method typing and params
- [ ] Update hook to keep previous data and expose summary states

## UI (Shadcn-first)

- [ ] Rebuild `OpsEmailDeliveryClient` layout (header, filters, summary, attempt list)
- [ ] Implement `OpsEmailDeliverySummaryMetrics`
- [ ] Implement `OpsEmailDeliveryAttemptCard` (status rail, expandable timeline)
- [ ] Update filters card search parsing and status counts
- [ ] Remove client-side grouping dependency from results list

## Dev Harness

- [ ] Update `devEmailDelivery.ts` mock service to match new contract + summary
- [ ] Add `/app/dev/ops-email-delivery` harness page (dev-only)

## Tests

- [ ] Update search tests
- [ ] Add summary metrics component tests
- [ ] Add Playwright smoke test using dev harness

## Verification (Required)

- [ ] Chrome DevTools MCP QA (console/network/a11y/perf) + artifacts
- [ ] `pnpm vitest run`
- [ ] `pnpm playwright test tests/e2e/ops-email-delivery-dev-harness.spec.ts`
- [ ] `pnpm run typecheck`
