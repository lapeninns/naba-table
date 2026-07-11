---
spec_id: MS-foundation-vitest-resolution-fixes
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/foundation/**
  - micro-specs/evidence/**
  - vitest.config.ts
  - tests/setup.ts
implementation_surfaces:
  - micro-specs/foundation/vitest-resolution-fixes.md
  - vitest.config.ts
  - tests/setup.ts
related_docs:
  - docs/qa/full-suite.md
related_tests:
  - tests/hooks/useOpsBookingsDialogs.test.tsx
  - tests/components/features/dashboard/OpsDashboardClient.test.tsx
verification_gates:
  - pnpm governance:check
  - pnpm test
  - pnpm lint
  - pnpm typecheck
  - pnpm run qa:foundation
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - Dormant-suite activation counts before/after.
approved_exceptions: []
---

# MS-foundation-vitest-resolution-fixes — Fix vitest alias resolution + matchMedia setup trap

## 1. Exact Goal and User-Visible Outcomes

Two test-infrastructure defects stop written tests from running. (a) `tsconfig`
resolves `@/*` with a root→`src/` fallback, but `vitest.config.ts` maps `@` to repo
root only, with per-file alias patches; six hook specifiers are missing
(`@/hooks/use-minimum-delay`, `@/hooks/ops/useOpsTodaySummary`,
`@/hooks/ops/useOpsBookingStatusSummary`, `@/hooks/ops/useOpsBookingsDialogs`,
`@/hooks/ops/useOpsBookingsLifecycleHandlers`,
`@/hooks/ops/useOpsEmailTemplatesPageState`), which blocks ~29 dormant dashboard
suites (written dual-mode, auto-activating) and 4 hook suites at Vite transform
time. (b) `tests/setup.ts` registers `window.matchMedia` as a `vi.fn()` while the
config sets `mockReset: true`, so the implementation is wiped before every test —
components consuming the MediaQueryList object crash unless suites re-install it.
When this ships, the six aliases resolve, the dormant suites activate, and
`matchMedia` survives mock resets as a plain function.

## 2. Blast Radius

In scope: `vitest.config.ts` (per-file alias lines following its existing pattern —
the six blocking specifiers plus the five transitive `@/hooks/ops/*` imports they
pull in: `useOpsBooking`, `useOpsCancelBooking`, `useOpsBookingStatusActions`,
`useOpsRestaurantEmailTemplates`, `utils`) and `tests/setup.ts` (matchMedia
registration only); this spec + evidence.

Out of scope: writing the 4 still-missing hook suites (hooks-closure spec owns
that); flipping dashboard dual-mode pins (they self-flip on successful import); all
product source; all other config.

## 3. Strict Constraints and Assumptions

- Alias lines must follow the file's existing convention (path.resolve to the
  specific `src/hooks/...` file) and change resolution for exactly the six
  specifiers.
- The matchMedia replacement keeps the identical MediaQueryList shape (matches,
  media, add/removeListener, add/removeEventListener, dispatchEvent) but as plain
  functions so `mockReset` cannot strip behavior; suites that spy can still wrap
  it.
- The full suite must stay green: if the setup.ts change breaks suites that assert
  on `matchMedia` mock internals, adapt the replacement (e.g. keep vi.fn per-call
  wrappers created lazily) — never weaken the suites.
- Dormant dashboard suites activating must all pass (they were verified green
  under a shadow config by their author).

## 4. Decisions Already Made

- Fix resolution with six explicit per-file aliases, not a generic root→src
  fallback resolver (smallest change; the generic fallback risks shadowing
  root-level modules).
- matchMedia becomes a stable plain-function factory in setup.ts.

## 5. Behavioral Requirements (EARS)

- THE six listed specifiers SHALL resolve under vitest to their `src/hooks`
  implementations.
- WHEN the dormant dashboard suites import their components, THE imports SHALL
  succeed and the suites SHALL run and pass.
- WHILE `mockReset: true` clears mock state between tests, THE `window.matchMedia`
  stub SHALL keep returning a functional MediaQueryList.
- IF a previously-green suite depends on the old matchMedia vi.fn identity, THEN
  THE implementation SHALL be adapted until the full suite is green without
  weakening any suite.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- `pnpm test` fully green with a higher executed-test count than before (dormant
  suites activated; report the delta).
- The 5 previously-blocked component files and 4 hook-suite targets import
  cleanly.
- All declared verification gates pass.

Tasks:

1. Add the six aliases; run the previously-blocked files.
2. Fix setup.ts matchMedia; run the full suite; adapt per constraint.
3. Record gates via `governance:run-gates --spec MS-foundation-vitest-resolution-fixes --record`;
   advance lifecycle.
