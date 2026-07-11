---
spec_id: MS-foundation-e2e-page-closure
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/foundation/**
  - micro-specs/evidence/**
  - tests/e2e/**
implementation_surfaces:
  - micro-specs/foundation/e2e-page-closure.md
  - tests/e2e/ops-dashboard-print.spec.ts
  - tests/e2e/ops-new-bookings.spec.ts
related_docs:
  - docs/qa/full-suite.md
related_tests:
  - tests/e2e/ops-dashboard-print.spec.ts
  - tests/e2e/ops-new-bookings.spec.ts
verification_gates:
  - pnpm governance:check
  - pnpm test
  - pnpm lint
  - pnpm typecheck
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - Local Playwright run output for the two new specs.
approved_exceptions: []
---

# MS-foundation-e2e-page-closure — E2e coverage for print and new-bookings pages

## 1. Exact Goal and User-Visible Outcomes

The last two shipped page areas with zero e2e coverage —
`src/app/app/(app)/dashboard/print/page.tsx` and
`src/app/app/(app)/new-bookings/page.tsx` — gain Playwright specs. When this
ships, every shipped page area has at least one e2e spec exercising it (the
2026-07-11 audit found these two as the only gaps), and both specs run under the
existing app-host Playwright config alongside their siblings.

## 2. Blast Radius

In scope: the two new spec files under `tests/e2e/`, this spec, and its evidence
ledger.

Out of scope: product source; Playwright configs (the app config's testDir
already picks up all of `tests/e2e`); CI wiring (the e2e workflows own that); the
authenticated-fixture limitation itself.

## 3. Strict Constraints and Assumptions

- Follow the conventions of the nearest sibling app-host specs (e.g.
  `ops-app-host-redirects.spec.ts`, `ui-visual-routes.spec.ts`): mock/local env,
  `QA_ENABLE_AUTH_FIXTURES` where siblings use it.
- Known limitation: authenticated rendering via QA fixtures is broken at the
  edge proxy locally; if the pages cannot render authenticated content, the spec
  MUST still assert the meaningful unauthenticated contract (redirect to
  sign-in / auth wall semantics) exactly as the redirect-spec siblings do — an
  honest thinner spec over a fake pass.
- Specs must pass locally before shipping (run them; record output).
- Tag titles per Playwright conventions used by sibling specs (`@browser`,
  `@smoke`).

## 4. Decisions Already Made

- Two separate spec files named after their routes.
- Print page: assert the route responds, renders its print-shell landmark, and
  (if reachable unauthenticated only) applies the documented auth behavior.
- New-bookings: assert route reachability and auth-wall behavior consistent with
  `ops-app-host-redirects.spec.ts` patterns.

## 5. Behavioral Requirements (EARS)

- THE two page areas SHALL each have a Playwright spec exercising their shipped
  route.
- WHILE fixture auth remains broken, THE specs SHALL assert the truthful
  reachable contract (auth wall/redirect) rather than skipping.
- IF a spec exposes a real routing/rendering defect, THEN THE implementer SHALL
  report it, not patch product code here.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- `pnpm exec playwright test -c playwright.app.config.ts tests/e2e/ops-dashboard-print.spec.ts tests/e2e/ops-new-bookings.spec.ts` passes locally.
- All declared verification gates pass.

Tasks:

1. Write both specs following sibling conventions; prove locally.
2. Record gates via `governance:run-gates --spec MS-foundation-e2e-page-closure --record`;
   advance lifecycle.
