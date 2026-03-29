---
task: customers-rebuild
timestamp_utc: 2026-03-29T17:45:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Automated verification

- `pnpm exec vitest run tests/lib/customerHistory.test.ts tests/components/features/customers/opsCustomersSelectors.test.ts tests/components/CustomersTable.test.tsx`
  - Passed
- `pnpm run typecheck`
  - Passed
- `pnpm exec eslint --max-warnings=0 lib/ops/customer-history.ts server/ops/customers.ts src/app/api/ops/customers/route.ts src/app/api/ops/customers/export/route.ts tests/lib/customerHistory.test.ts`
  - Passed
- `git diff --check`
  - Passed

## Manual QA — Chrome DevTools MCP

Target:

- `http://localhost:3000/dev/ops-customers`

Notes:

- The dev harness remains a UI-only in-memory service and does not exercise the production `/api/ops/customers` route.
- Production correctness for this rewrite is covered by the new canonical guest-history tests and the rebuilt shared rollup helper.

### UI behavior verified

- Guests page renders successfully in the harness.
- Search input still debounces into URL state:
  - `sam.patel` updates the URL to `?search=sam.patel`
  - list narrows to the matching guest
  - summary metrics update to the filtered result set
- Focus deep-link still works:
  - `?focus=sam.patel@example.com` scrolls/focuses the Sam Patel card
  - active element resolves to `data-customer-id="cust-2"`
- Screenshot saved:
  - [`artifacts/ops-customers-rebuild-dev-harness.png`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/tasks/customers-rebuild-20260329-1745/artifacts/ops-customers-rebuild-dev-harness.png)

### Console/runtime

- No customers-specific console errors.
- Baseline local-dev warning remains:
  - PostHog env warning in the harness

## Data correctness checks

- Added canonical tests for booking-derived guest history in [`tests/lib/customerHistory.test.ts`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/tests/lib/customerHistory.test.ts)
- Verified:
  - waitlist rows are excluded
  - cancellations count correctly
  - cancelled and future bookings do not become “last visit”
  - guests with only cancelled history remain “never visited”
  - filters, sort, and summary use the rebuilt rollup semantics

## Artifacts

- Screenshot: [`artifacts/ops-customers-rebuild-dev-harness.png`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/tasks/customers-rebuild-20260329-1745/artifacts/ops-customers-rebuild-dev-harness.png)
- Command log: [`artifacts/checks.txt`](/Users/amankumarshrestha/.codex/worktrees/1d2c/nabatableLP/tasks/customers-rebuild-20260329-1745/artifacts/checks.txt)

## Outcome

- Customers page server contract now derives guest history from live booking data instead of `customer_profiles` snapshot fields.
- Export uses the same canonical rollup source.
- Client behavior remains intact.
