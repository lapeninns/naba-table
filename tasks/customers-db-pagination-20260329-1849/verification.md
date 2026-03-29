---
task: customers-db-pagination
timestamp_utc: 2026-03-29T18:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Automated verification

- `pnpm exec vitest run tests/lib/customerHistory.test.ts tests/server/ops/customers.test.ts tests/components/features/customers/opsCustomersSelectors.test.ts tests/components/CustomersTable.test.tsx`
  - Passed
- `pnpm run typecheck`
  - Passed
- `pnpm exec eslint --max-warnings=0 server/ops/customers.ts lib/ops/customer-history.ts src/app/api/ops/customers/route.ts src/app/api/ops/customers/export/route.ts src/components/features/customers/OpsCustomersClient.tsx src/components/features/customers/OpsGuestCard.tsx tests/lib/customerHistory.test.ts tests/server/ops/customers.test.ts`
  - Passed
- `git diff --check`
  - Passed

## Manual QA — Chrome DevTools MCP

- Target:
  - `http://localhost:3000/dev/ops-customers`
- Notes:
  - The dev harness remains an in-memory UI surface and does not exercise the RPC-backed `/api/ops/customers` route directly.
  - UI verification here confirms unchanged operator behavior; server correctness for the new path is covered by the targeted server tests.

### UI behavior verified

- Guests page renders successfully in the dev harness.
- Search still debounces into URL state:
  - entering `sam.patel` updated the URL to `?search=sam.patel`
  - the guest list narrowed to Sam Patel
  - summary metrics updated to `1` total guest
- Console remained clean with no messages.
- Screenshot saved:
  - [`artifacts/ops-customers-db-pagination-dev-harness.png`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/tasks/customers-db-pagination-20260329-1849/artifacts/ops-customers-db-pagination-dev-harness.png)

## Migration rollout notes

- Added migration:
  - [`supabase/migrations/20260329190000_add_ops_customers_history_rpc.sql`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/supabase/migrations/20260329190000_add_ops_customers_history_rpc.sql)
- Required rollout:
  - apply on remote staging first
  - verify feed and summary RPCs resolve through Supabase schema cache
  - then apply to production in a change window
- Rollback:
  - server code includes a temporary fallback to the previous in-memory path when the RPC functions are unavailable
  - if the migration must be rolled back, the customers page remains functional but loses the DB-side pagination improvement until the follow-up cleanup is done

## Artifacts

- Screenshot: [`artifacts/ops-customers-db-pagination-dev-harness.png`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/tasks/customers-db-pagination-20260329-1849/artifacts/ops-customers-db-pagination-dev-harness.png)
- Command log: [`artifacts/checks.txt`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/tasks/customers-db-pagination-20260329-1849/artifacts/checks.txt)

## Outcome

- Ops customers list and summary now have a DB-backed primary path via Supabase RPCs.
- The paginated API no longer needs to fetch and recompute the full guest-history dataset on every page request when the migration is available.
- Export pages through the same DB-backed feed RPC in batches to preserve live-booking semantics.
- Route behavior remains safe during rollout because the old in-memory path remains as a migration-missing fallback.
