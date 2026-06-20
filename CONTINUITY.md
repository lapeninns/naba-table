# Continuity Ledger

Last updated: 2026-06-19T07:23:44Z

## Current GBP directory architecture review

- Task harness: `tasks/gbp-directory-architecture-review-20260619-0715/`.
- Current verdict: GBP is not required for core Nabatable, but it is strategically useful for a future directory only as an authorised bootstrap, verification, and drift-signal layer.
- Key architecture decision: do not render raw GBP/provider mirrors directly on public directory pages. Add a separate directory/public profile publication model with source rights, approval states, freshness, attribution metadata, and a public-safe read model.
- Recommended product stance: merchant connects GBP -> Nabatable imports a private directory draft -> merchant/admin approves fields -> Nabatable publishes its own public profile. Dual-sync remains the advanced two-way Google management surface.
- Explicit non-claims: no live Google OAuth, no production/staging Supabase readback, no deployed cron verification, and no app/browser UI verification were performed for this analysis-only slice.

## Goal (incl. success criteria)

- Execute the ground-up Nabatable UX/UI redesign (`Goal.md`): mobile-first, calm hospitality OS, preserving behavior, routes, backend contracts, permissions, and Supabase safety rules. Current phase: layout redesign before visual decoration (inventory → layout system → apply to shipped routes → verify at 375/768/1440).
- Success per slice: design-system + layout-system rules hold, real-route browser proof at 375/768/1440, validations green, task folder current.

## Constraints/Assumptions

- High-risk cross-surface work; one Radix Luma shadcn theme for ops and guest/public; `components/ui/*` is the single primitive root; `scripts/check-no-shadcn.mjs` must stay green.
- `tailwind.config.js` is dead at runtime (Tailwind v4 via `@tailwindcss/postcss`, no `@config` anywhere); the live theme is `src/app/globals.css` `@theme inline` + `styles/design-system/*.css`.
- Browser proof for authenticated ops routes uses the QA fixture runtime (cookie `__nabatable_qa_ops_auth=enabled` on `app.localhost:5180`, `QA_ENABLE_AUTH_FIXTURES=1 QA_USE_MOCKS=1`) plus Playwright page-level `/api/ops/**` mocks — server ops APIs 401 otherwise and the client redirects to signin.

## Key decisions

- Foundation slice (see `tasks/uxui-redesign-foundation-20260612-2054/`): token refinement over replacement; fixed rem type steps, no negative tracking; restrained radii; focus-visible rings on six primitives; `OpsMobileBottomNav` on <md; bookings/email-log StaleBoundary; landing calm pass.
- **Layout system defined** in `tasks/layout-redesign-system-20260612-2202/layout-system.md` (binding rules: shells, headers, nav, width table, list/detail, form, table→card, state layouts) with full route-family inventory in `layout-inventory.md`.
- Ops list pattern = card list at all widths (BookingsTable/CustomersTable already are). Real tables: ≤5 cols → CSS `md:` split; ≥6 cols → `useIsMobile(1024)` JS gate (keeps singular accessible names for jsdom suites). Email delivery log is the reference: attempt cards <lg (orphaned `OpsEmailDeliveryAttemptCard` wired up, retry parity via shared aria-label), sortable table ≥lg.
- `useIsMobile` gained an optional `breakpoint` param (default 768; Sidebar unchanged).
- Customers list adopted `StaleBoundary` + `getSwrUiState` (query exposed as `customersQuery` from `useOpsCustomersDataState`); toolbar/summary stay outside the boundary.
- vitest alias added for `@/hooks/use-copy-to-clipboard` (src-located hook, same pattern as `useGlobalShortcuts`).

## State

- Foundation slice verified (see prior ledger entry / task folder).
- Layout slice complete and verified in `tasks/layout-redesign-system-20260612-2202/`: typecheck, guard, targeted eslint/prettier, vitest (80 email + 16 customers tests), new e2e `tests/e2e/ops-layout-system.spec.ts` **8/8** (email log cards@375/768 + table@1440, customers stale boundary, dashboard 768 shell, bookings 1440, landing 3 widths; screenshots in `artifacts/`), regression `ops-mobile-redesign` + `ops-sidebar-active-state` + `ops-authenticated-app-host` **10/10**.
- Sidebar active-state `opsHref` fix verified via `ops-sidebar-active-state.spec.ts` (was already in working tree).
- All redesign work remains uncommitted in the working tree (foundation + layout slices).

## Now

- Layout slice handed off; goal deliverables 1–5 met for representative routes.

## Next

- Settings conformance sweep against layout-system §7 (form grid, sticky action rows, remove shadow class shims).
- Email queue tab table → responsive pattern (§8); analytics tab spot check.
- Filter toolbar → Sheet escalation where >2 wrapped rows at 375px (email log filter stack, customers mobile header/filter stack are first candidates).
- Guest portal spot checks at 768 (booking detail `xl:` sidebar stacking).
- Carried: tracking-tight sweep; reserve token unification; dead `tailwind.config.js` removal; landing content authenticity (owner decision).

## Open questions (UNCONFIRMED if needed)

- None blocking.

## Working set (files/ids/commands)

- `tasks/layout-redesign-system-20260612-2202/**` (research, layout-inventory, layout-system, plan, verification, artifacts)
- `src/components/features/email-delivery/components/{OpsEmailDeliveryTable,OpsEmailDeliveryAttemptCard}.tsx`
- `src/components/features/customers/{OpsCustomersClient,useOpsCustomersDataState}.ts(x)`
- `hooks/use-mobile.ts`, `vitest.config.ts`
- `tests/e2e/ops-layout-system.spec.ts`
- `QA_TARGET_ENV=local pnpm exec playwright test -c playwright.app.config.ts tests/e2e/ops-layout-system.spec.ts`
