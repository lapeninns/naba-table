---
task: ops-email-delivery-dashboard
timestamp_utc: 2026-02-06T21:28:53Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

Routes tested:

- `http://localhost:3000/dev/ops-email-delivery` (dev harness; no auth required)

Routes not tested (auth-gated in this environment):

- `http://localhost:3000/app/email-delivery` (real Ops route; requires auth + RPCs deployed)
- `http://localhost:3000/app/dev/ops-email-delivery` (dev harness under `/app`; requires auth in-browser)

### Console & Network

- [x] No console errors during filter/search/expand interactions (PostHog debug logs only)
- [x] Keyboard interactions verified (Tab focus hits: bookings link, searchbox, buttons, range radios)
- [!] Dev harness uses in-memory services via `OpsDevProviders`; API network traces are not representative here.
  - Contract is enforced via types + server code:
    - `summary` is only returned when `page === 1`
    - attempts are attempt-level rows (`messageId + recipientEmail`) with expandable `events[]`

### DOM & Accessibility

- [x] Keyboard navigation reaches filters, KPIs, attempt rows, and expand controls
- [x] Expand/collapse controls toggle and reflect `aria-expanded`
- [x] Focusable controls have visible focus ring (no clipped outline observed)

### Performance (profiled; mobile; 4× CPU; 4G)

- Trace: Slow 4G + 4x CPU (Chrome DevTools MCP)
  - LCP: 2.485 s
  - CLS: 0.00
  - Budgets met: [x] Yes [ ] No
- Trace: default (no throttling)
  - LCP: 0.171 s
  - CLS: 0.00

Notes:

- DevTools MCP trace summary doesn’t surface FCP/TBT directly; we recorded traces for follow-up analysis.

### Device Emulation

- [x] Mobile (≈390px)
- [x] Tablet (≈768px)
- [x] Desktop (≥1280px)

## Automated Tests

- [x] `pnpm run typecheck`
- [x] `pnpm vitest run`
- [x] `pnpm playwright test tests/e2e/ops-email-delivery-dev-harness.spec.ts`

## DB / Migration Evidence

- [!] Supabase is remote-only; migration must be applied to staging then production for the real Ops route to work.
  - Migration file added:
    - `supabase/migrations/20260206213430_ops_email_delivery_attempts_dashboard.sql`
  - Rollback plan:
    - `DROP FUNCTION IF EXISTS public.ops_email_delivery_attempts_feed(...)`
    - `DROP FUNCTION IF EXISTS public.ops_email_delivery_attempts_summary(...)`
    - `DROP INDEX IF EXISTS public.email_delivery_log_restaurant_occurred_at_id_idx`
  - Dry-run diff evidence: pending (requires connected Supabase CLI + staging/prod access)

## Artifacts

- Screenshots:
  - `artifacts/dev-ops-email-delivery-desktop.png`
  - `artifacts/dev-ops-email-delivery-tablet.png`
  - `artifacts/dev-ops-email-delivery-mobile.png`
- Traces:
  - `artifacts/dev-ops-email-delivery-trace.json.gz`
  - `artifacts/dev-ops-email-delivery-trace-slow4g-cpu4.json.gz`

## Known Issues

- None
