---
spec_id: MS-guest-reserve-standalone-ui
status: verified
risk_class: ui-only
owner: amankumarshrestha
last_reviewed: 2026-07-12
allowed_blast_radius:
  - micro-specs/guest/**
  - reserve/.storybook/**
  - reserve/features/reservations/wizard/ui/steps/DetailsStep.tsx
  - reserve/features/reservations/wizard/ui/steps/plan-step/**/*.stories.tsx
  - reserve/main.tsx
  - tests/e2e/guest-reserve-routes.spec.ts
  - tests/reserve/standalone-boundaries.test.ts
  - tasks/customer-booking-wizard-audit-20260712-1004/**
  - CONTINUITY.md
  - package.json
implementation_surfaces:
  - reserve/.storybook/**
  - reserve/features/reservations/wizard/ui/steps/DetailsStep.tsx
  - reserve/features/reservations/wizard/ui/steps/plan-step/**/*.stories.tsx
  - reserve/main.tsx
  - tests/e2e/guest-reserve-routes.spec.ts
  - tests/reserve/standalone-boundaries.test.ts
  - package.json
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/e2e/guest-reserve-routes.spec.ts
  - tests/reserve/standalone-boundaries.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm test --maxWorkers=8
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm reserve:build
  - pnpm storybook:build
  - pnpm guard:no-shadcn:strict
  - pnpm guard:luma:strict
  - pnpm qa:reserve-app:browser
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions:
  - 'evidence-waiver: verified on the intentionally uncommitted audit task tree; no commit was requested (expires: 2026-07-19)'
---

# MS-guest-reserve-standalone-ui — Reserve standalone UI pipeline

## 1. Exact Goal and User-Visible Outcomes

Guests using the standalone Reserve application receive the same complete, animated Luma UI as
the shared Next.js surface, and can open the privacy notice without a Next.js router dependency.
Maintainers can build and boot Storybook and use every existing Plan-step story without a render
or interaction error.

## 2. Blast Radius

In scope: the standalone Reserve CSS entry, the Details privacy link, Storybook ESM configuration,
Plan-step story fixtures, the tagged Reserve browser contract, and the task evidence named in the
frontmatter. Out of scope: customer form validation, consent defaults, ops-mode behavior, shared UI
primitive styling, the Next.js global stylesheet, data/API contracts, and dependencies.

## 3. Strict Constraints and Assumptions

- The standalone bundle must reuse the existing Tailwind v4/Luma source of truth rather than
  defining a parallel utility or token layer.
- Story fixes must supply realistic providers and interactions without changing production form
  behavior to accommodate Storybook.
- Generated Storybook output must stay outside the `reserve/**` source tree scanned by strict UI
  guards.
- Browser proof must use the real Reserve entrypoint and must not treat static source inspection as
  proof that CSS utilities or links work.
- Existing reduced-motion behavior remains authoritative.

## 4. Decisions Already Made

- The root Tailwind v3-style config is not the standalone Reserve pipeline; Tailwind v4 is driven by
  the existing global CSS entry and PostCSS plugin.
- The privacy notice is a cross-surface navigation target and does not need client-side routing
  state from the Reserve SPA.
- The existing OccasionPicker, PlanStepForm, and Calendar24Field stories remain the isolated Plan
  review set; this slice repairs their fixtures rather than adding a new component system.
- Storybook build artifacts belong under the ignored `test-results/**` evidence root, not under
  `reserve/**` production source.

## 5. Behavioral Requirements (EARS)

- WHEN the standalone Reserve application builds, THE emitted stylesheet SHALL include the layout,
  responsive, state, arbitrary-value, and animation utilities used by the wizard.
- WHEN a guest expands or collapses a wizard accordion without reduced motion enabled, THE
  accordion content SHALL use the declared open or close animation rather than changing instantly
  because its keyframes were omitted.
- WHEN a guest activates the Details privacy-notice link, THE browser SHALL navigate to `/privacy`
  without loading a Next.js client-router module in the Reserve step.
- WHEN Storybook builds or boots, THE preview SHALL resolve its aliases in ESM without relying on a
  CommonJS-only directory global.
- WHEN each existing Plan-step story runs, THE story SHALL render and complete its interaction
  assertion without an uncaught console error.

## 6. Verification Criteria and Task Breakdown

Acceptance requires a production Reserve bundle whose computed layout and accordion animation are
present, a Details privacy link that changes the browser location to `/privacy`, a successful
Storybook production build, and a live Storybook session where all three existing Plan stories
render and their play functions finish without console errors.

Task breakdown: (1) preserve the failing Storybook build and missing computed-style evidence; (2)
repair ESM configuration and story providers/interactions; (3) connect the standalone app to the
existing Tailwind v4/Luma CSS source and remove its duplicate imports; (4) replace the Reserve-only
Next router link with cross-surface navigation; (5) add the tagged shipped-entry browser contract;
(6) run and record all declared gates, then advance the lifecycle.
