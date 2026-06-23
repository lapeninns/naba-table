# floor-plan-audit-remediation - Work Plan

## TL;DR (For humans)

**What you'll get:** A finished, audit-backed floor-plan remediation that makes the live ops floor plan usable on phones, tablets, and desktop during service: compact top content, accessible controls, reliable table selection, visible focus, and browser evidence from the real app route.

**Why this approach:** The tree already contains partial floor-plan fixes, so the worker must reconcile and protect what is already there before adding more. The plan keeps the work `ui-only`, uses the existing shadcn/Luma floor-plan stack, and requires shipped-route proof rather than harness-only screenshots.

**What it will NOT do:** It will not touch booking/capacity rules, Supabase, auth, proxy routing, notifications, dark mode, or shared primitives unless a blocker is proven and approved. It will not revert unrelated dirty files.

**Effort:** Medium
**Risk:** Medium - the UI scope is narrow, but the worktree is dirty and the final gate depends on authenticated real-route browser proof.
**Decisions to sanity-check:** The plan treats the audit brief as authoritative, requires a narrow Micro-Spec before further product edits, and uses an unscaled/coarse-pointer hit-target strategy if transformed table buttons still render below 44px.

Your next move: run this through LazyCodex execution, or run a high-accuracy plan review first. Full execution detail follows below.

---

> TL;DR (machine): Medium ui-only remediation; reconcile dirty floor-plan fixes, close remaining audit gaps, add tests, and verify `app.localhost:3000/floor-plan` at mobile/tablet/desktop widths.

## Scope

### Must have

- Treat `.audit/floor-plan/AUDIT_BRIEF.md` as the source of truth for the remediation.
- Preserve the current dirty worktree. Classify floor-plan changes already present as accepted, incomplete, or out-of-scope before editing them.
- Create or activate a narrow `ui-only` Micro-Spec for the audit remediation before any additional product code changes.
- Keep the implementation in the floor-plan UI layer unless a shared primitive defect is proven and approved.
- Fix or prove fixed every audit issue:
  - mobile dangling separator in the page header;
  - mobile stat density and map-first reachability;
  - transformed table touch targets and accidental touch drag;
  - zoom-control overlay collision on narrow canvases;
  - TimeScrubber raw epoch accessibility value;
  - weak stat/section/zone accessible grouping and document outline;
  - low-contrast focus-visible affordance on floor-plan controls;
  - loading/error/empty parity for the audited layout.
- Add tests for the behavior that can be asserted in Vitest and Playwright.
- Re-run focused tests, UI guards, typecheck, lint, and real shipped-route browser proof.

### Must NOT have (guardrails, anti-slop, scope boundaries)

- Must not edit `src/proxy.ts`, auth/session code, Supabase clients, migrations, RLS/RPC functions, booking lifecycle/capacity mutations, provider webhooks, analytics, or notification systems.
- Must not add a new UI library, duplicate primitive layer, or one-off base components outside the existing shadcn/Luma system.
- Must not implement ops dark mode; the audit explicitly says light-only ops is by design.
- Must not treat harness no-op actions, harness mock zone constants, mock scrubber state, or the dev venue name as product bugs.
- Must not claim harness screenshots as final proof. Harness evidence is supplemental only.
- Must not revert unrelated dirty files such as auth/env/script changes unless the user explicitly asks.

## Verification strategy

> Zero human intervention - all verification is agent-executed.

- Test decision: TDD for every not-yet-implemented audit requirement; characterization tests first for behavior already present in the dirty tree. Use Vitest/Testing Library for component semantics and pure viewport/projection math; use Playwright for real-route responsive and interaction proof.
- Evidence root: `.omo/evidence/floor-plan-audit-remediation/`
- Focused Vitest gate:
  - `pnpm exec vitest run tests/components/floor-plan/FloorPlanShell.test.tsx tests/components/floor-plan/layout.test.ts tests/components/floor-plan/project.test.ts tests/components/floor-plan/viewport.test.ts tests/components/floor-plan/joins.test.ts tests/components/floor-plan/serviceState.test.ts tests/components/floor-plan/timeSelection.test.ts`
  - plus any new test files added by this plan, especially `TimeScrubber`, `FloorPlanCockpit`, `TableNode`, and `FloorPlanCanvas` tests.
- Governance/diagnostics:
  - `pnpm guard:micro-specs`
  - `pnpm guard:no-shadcn:strict`
  - `pnpm guard:luma:strict`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm exec prettier --check .omo/plans/floor-plan-audit-remediation.md .audit/floor-plan/AUDIT_BRIEF.md micro-specs/02-ops/01-floor-plan-audit-remediation.md src/components/features/floor-plan tests/components/floor-plan`
- Browser proof:
  - Prefer the real authenticated app-host route: `http://app.localhost:3000/floor-plan`.
  - If port 3000 is already running, inspect and reuse it when it is the correct Nabatable app server; do not start a second Next 16 dev server that fights `.next/dev/lock`.
  - Capture mobile 375x812, tablet 846x900, desktop 1280x900, and one narrow 320-430px canvas scenario.
  - Prove no horizontal overflow, clean console, useful accessibility snapshot values, visible focus, table selection opens the correct aside/sheet, scrubber keyboard/pointer works, and transformed table hit targets meet the accepted strategy.

## Execution strategy

### Parallel execution waves

> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

- Wave 0 is serial: establish governance, reconcile dirty state, and build the audit matrix.
- Wave 1 can split across header/cockpit/loading, scrubber/accessibility, and map interaction if using LazyCodex workers, but each worker must own disjoint files.
- Wave 2 is serial integration: resolve overlap, run focused tests, and inspect the real route.
- Wave 3 is final QA/review and commit preparation.

### Dependency matrix

| Todo | Depends on    | Blocks              | Can parallelize with |
| ---- | ------------- | ------------------- | -------------------- |
| 1    | none          | 2, 3, 4, 5, 6, 7, 8 | none                 |
| 2    | 1             | 3, 4, 5, 6, 7, 8    | none                 |
| 3    | 2             | 8, F1-F4            | 4, 5, 6              |
| 4    | 2             | 8, F1-F4            | 3, 5, 6              |
| 5    | 2             | 8, F1-F4            | 3, 4, 6              |
| 6    | 2             | 8, F1-F4            | 3, 4, 5              |
| 7    | 2             | 8, F1-F4            | 3, 4, 5, 6           |
| 8    | 3, 4, 5, 6, 7 | F1-F4               | none                 |

## Todos

> Implementation + Test = ONE todo. Never separate.

<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [ ] 1. Governance and dirty-worktree reconciliation
     What to do / Must NOT do: Snapshot `git status --short`, `git diff --stat`, and the floor-plan diff. Record unrelated dirty files as out-of-scope. Classify each dirty floor-plan file as accepted audit remediation, incomplete remediation, unrelated floor-plan change, or needs user approval. Must not revert or stage unrelated changes.
     Parallelization: Wave 0 | Blocked by: none | Blocks: every implementation todo.
     References (executor has NO interview context - be exhaustive): `AGENTS.md`; `micro-specs/GLOBAL_CONTEXT.md:71-105`; `.audit/floor-plan/AUDIT_BRIEF.md:111-125`; `tasks/floor-plan-ui-reference-revision-20260623-1118/progress.md:9-15`.
     Acceptance criteria (agent-executable): `.omo/evidence/floor-plan-audit-remediation/01-dirty-worktree.md` exists and lists every currently modified/untracked floor-plan path plus unrelated modified paths that must be avoided.
     QA scenarios (exact tool + invocation): happy: run `git status --short > .omo/evidence/floor-plan-audit-remediation/01-git-status.txt`; failure: if an unrelated dirty file overlaps an intended edit, stop and record the conflict in `01-dirty-worktree.md`.
     Commit: N | planning/evidence only.

- [ ] 2. Micro-Spec activation for audit remediation
     What to do / Must NOT do: Add `micro-specs/02-ops/01-floor-plan-audit-remediation.md` unless an equivalent active spec is discovered first. The spec must be `risk_class: ui-only`, status `active`, and define an allowed blast radius limited to `.audit/floor-plan/AUDIT_BRIEF.md`, `src/components/features/floor-plan/**`, `tests/components/floor-plan/**`, the task/evidence folder, and the plan artifact. Include EARS requirements for the audit issues and real-route verification. Do not restate Global Context rules beyond references.
     Parallelization: Wave 0 | Blocked by: 1 | Blocks: product edits.
     References: `micro-specs/README.md:1-90`; `micro-specs/GLOBAL_CONTEXT.md:71-105`; `.audit/floor-plan/AUDIT_BRIEF.md:79-104`.
     Acceptance criteria: `pnpm guard:micro-specs` passes. The new spec lists real `related_tests` planned under `tests/components/floor-plan/**` and verification gates that exist.
     QA scenarios: happy: run `pnpm guard:micro-specs | tee .omo/evidence/floor-plan-audit-remediation/02-micro-spec.log`; failure: intentionally missing required frontmatter is rejected by the guard before production edits continue.
     Commit: Y | `docs(ops): add floor plan audit remediation spec`

- [ ] 3. Header, cockpit, and loading layout remediation
     What to do / Must NOT do: Fix the mobile header meta so the status badge can wrap without leaving a dangling separator. Keep the summary concise and avoid changing shared `OpsPageHeader` unless a local `FloorPlanHeader` composition cannot solve it. Ensure the cockpit stays compact on mobile and is semantically grouped, with number/label/detail tied together for assistive tech. Ensure the loading skeleton mirrors the final map-first proportions and does not show a desktop aside on mobile. Must not reintroduce tall 220px stat cards or force the Refresh button into a layout that pushes the map further down.
     Parallelization: Wave 1 | Blocked by: 2 | Blocks: 8, final QA.
     References: `.audit/floor-plan/AUDIT_BRIEF.md:79-84,98-101`; `src/components/features/floor-plan/FloorPlanHeader.tsx:16-36`; `src/components/features/ops-shell/patterns/OpsPageHeader.tsx:54-58`; `src/components/features/floor-plan/FloorPlanCockpit.tsx:33-44`; `src/components/features/floor-plan/FloorPlanClient.tsx:77-96`; `tests/components/floor-plan/FloorPlanShell.test.tsx:85-98`.
     Acceptance criteria: Add or extend component tests so the rendered header has no visible separator on mobile when the badge wraps, the cockpit has an accessible service summary group, and skeleton layout hides the aside below `lg`. Focused Vitest command passes for new/changed tests.
     QA scenarios: happy: Playwright at 375x812 shows no dangling separator and the Floor map begins within the planned mobile scroll budget; failure: force a narrow width around 320-390px and assert `document.documentElement.scrollWidth === window.innerWidth`.
     Commit: Y | `fix(floor-plan): compact mobile summary and loading layout`

- [ ] 4. TimeScrubber accessibility and mobile interaction remediation
     What to do / Must NOT do: Replace raw epoch `aria-valuenow` exposure with a service-window minute offset while keeping internal millisecond math. Keep `aria-valuetext` human-readable with local clock text. Preserve pointer drag, keyboard Arrow/Page/Home/End behavior, 44px track height, narrow-label thinning, and no minor ticks below `lg`. Must not evaluate harness no-op Play behavior as a product bug.
     Parallelization: Wave 1 | Blocked by: 2 | Blocks: 8, final QA.
     References: `.audit/floor-plan/AUDIT_BRIEF.md:95-97,111-119`; `src/components/features/floor-plan/TimeScrubber.tsx:42-81,121-181,188-241`.
     Acceptance criteria: Add `tests/components/floor-plan/TimeScrubber.test.tsx` covering human `aria-valuetext`, numeric minute-offset `aria-valuenow`, keyboard stepping, and pointer scrubbing callback rounding. `pnpm exec vitest run tests/components/floor-plan/TimeScrubber.test.tsx` passes.
     QA scenarios: happy: Playwright accessibility snapshot for the real route exposes "Service time" with a human value rather than a 13-digit epoch; failure: assert no slider node value/name/description contains `/\b\d{13}\b/`.
     Commit: Y | `fix(floor-plan): expose readable service scrubber values`

- [ ] 5. Canvas, transformed table hit targets, and zoom overlay remediation
     What to do / Must NOT do: Prove the current viewport/projection changes first, then close the remaining map interaction gaps. Keep `expandContentFrame`, `fitToViewport`, and drag coordinate inversion tested. If transformed table buttons render below the accepted 44px visual target at mobile fit scale, add a coarse-pointer-safe interaction layer or equivalent unscaled hit-target strategy so touch selection targets are at least 44x44 without distorting the visible floor geometry. Keep mouse/pen drag-to-move on fine pointers; prevent accidental touch layout edits. Reposition or restyle zoom controls on narrow canvases so they do not hide top-right tables; use elevated shadcn/Luma styling and hide the percent chip on the smallest widths if needed. Must not solve visual target size by only increasing text inside scaled tiles.
     Parallelization: Wave 1 | Blocked by: 2 | Blocks: 8, final QA.
     References: `.audit/floor-plan/AUDIT_BRIEF.md:43-45,54-57,85-87,91-94,102-103`; `src/components/features/floor-plan/FloorPlanCanvas.tsx:101-119,120-163`; `src/components/features/floor-plan/FloorPlanZoomControls.tsx:15-30`; `src/components/features/floor-plan/TableNode.tsx:55-80,95-143`; `src/components/features/floor-plan/domain/viewport.ts:40-80`; `src/components/features/floor-plan/domain/layout.ts:177-190`; `tests/components/floor-plan/viewport.test.ts:57-98`.
     Acceptance criteria: Add or extend tests proving touch slop does not commit drag under threshold, keyboard activation still selects movable tables, viewport frame fitting remains centered, and any new coarse-pointer hit-target helper computes min 44px boxes. Focused floor-plan Vitest passes.
     QA scenarios: happy: Playwright at 375x812 and 320-430px canvas measures every touch-selectable table target at >=44px or records the approved exception and zoom affordance; selects a table without drag mutation; zoom controls do not cover a table center. failure: simulate a 6px touch jitter and assert no layout mutation callback fires.
     Commit: Y | `fix(floor-plan): harden mobile map touch targets`

- [ ] 6. Detail sheet, zone outline, focus, and status semantics
     What to do / Must NOT do: Confirm the bottom Sheet behavior remains polished and sourced from the single `TableDetailView` body. Strengthen document outline and semantics by giving the floor map title, service states, cockpit, and zone occupancy meaningful headings/groups without adding visible instructional text. Use local floor-plan focus classes or token-safe styles so keyboard focus is clearly visible on table nodes, scrubber, zoom controls, filter chips, and sheet actions. Preserve status dot + text label; never make color the only status signal.
     Parallelization: Wave 1 | Blocked by: 2 | Blocks: 8, final QA.
     References: `.audit/floor-plan/AUDIT_BRIEF.md:26-30,61-70,88-104`; `src/components/features/floor-plan/FloorPlanDetailPanel.tsx:61-121`; `src/components/features/floor-plan/TableDetailView.tsx:63-190`; `src/components/features/floor-plan/ZoneOccupancySummary.tsx:10-33`; `src/components/features/floor-plan/FloorPlanShell.tsx:61-139`; `src/components/features/floor-plan/TableNode.tsx:95-143`.
     Acceptance criteria: Component tests verify selected table opens the sheet below `lg` and aside at `lg+`, zone summary has accessible grouping, status labels are present in table button names, and focus classes use a contrast-safe local style. No duplicate visible detail view is introduced.
     QA scenarios: happy: Playwright keyboard-tabs through desktop and mobile floor-plan controls and captures focus-visible screenshots; failure: accessibility snapshot must not show table status represented by color alone.
     Commit: Y | `fix(floor-plan): improve floor plan semantics and focus`

- [ ] 7. Empty, error, loading, and edge-state audit pass
     What to do / Must NOT do: Review `FloorPlanClient` load/error/empty/ready branches and floor-plan derived state for edge cases: no tables, no zones, long venue/table/zone names, all-free state, all-filtered/dimmed state, narrow/long service window, seeded layout, and unavailable actions. Add tests where these states can be rendered without Supabase. Must not change data fetching, auth, or booking mutation behavior.
     Parallelization: Wave 1 | Blocked by: 2 | Blocks: 8, final QA.
     References: `.audit/floor-plan/AUDIT_BRIEF.md:15-34,122-125`; `src/components/features/floor-plan/FloorPlanClient.tsx:33-74,77-96`; `src/components/features/floor-plan/useFloorPlanState.ts:61-184,186-325`; `src/components/features/floor-plan/FloorPlanLegendFilter.tsx`; `src/components/features/floor-plan/serviceStateStyles.ts`.
     Acceptance criteria: Tests cover at least loading, empty, active filter clear pill, long label wrapping, and no horizontal-overflow-prone text. Existing service state and layout tests remain green.
     QA scenarios: happy: run a harness or mocked component render with long names and assert no console errors or horizontal overflow; failure: force empty `zones` and `nodes` and assert the user sees a useful empty/default state rather than broken chrome.
     Commit: Y | `test(floor-plan): cover audited edge states`

- [ ] 8. Integration verification and evidence packaging
     What to do / Must NOT do: Run the focused floor-plan test set, guards, typecheck, lint, and browser proof after all changes. Save raw logs and screenshots under `.omo/evidence/floor-plan-audit-remediation/`. Compare the final UI against every audit issue and mark each as fixed, already satisfied, or accepted exception with proof. Must not claim success if route proof was harness-only or if the active server/auth setup is ambiguous.
     Parallelization: Wave 2 | Blocked by: 3, 4, 5, 6, 7 | Blocks: final verification wave.
     References: `micro-specs/GLOBAL_CONTEXT.md:71-105`; `.audit/floor-plan/AUDIT_BRIEF.md:106-125`; memory-derived dev-server caveat: Next 16 `.next/dev/lock` can block a second dev server while `:3000` is already running.
     Acceptance criteria: Evidence folder contains `08-vitest.log`, `08-guards.log`, `08-typecheck.log`, `08-lint.log`, `08-playwright-mobile.log`, screenshots for 375/846/1280, an accessibility snapshot summary, console output, and `08-audit-closure.md`.
     QA scenarios: happy: `http://app.localhost:3000/floor-plan` renders authenticated floor-plan content at all target widths and passes assertions; failure: if redirected to `/auth/signin`, record auth fixture/server mismatch and do not mark final proof complete.
     Commit: Y | `test(floor-plan): add audit closure evidence`

## Final verification wave

> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.

- [ ] F1. Plan compliance audit
      Verify every todo acceptance criterion has an artifact and every audit finding in `.audit/floor-plan/AUDIT_BRIEF.md:79-104` is closed or explicitly accepted. Evidence: `.omo/evidence/floor-plan-audit-remediation/F1-plan-compliance.md`.
- [ ] F2. Code quality review
      Review the final diff for shadcn/Luma compliance, no `as any`/type suppressions, no speculative abstraction, no shared primitive churn, no accidental data/auth/proxy edits, and no unrelated file changes bundled into the floor-plan commit. Evidence: `.omo/evidence/floor-plan-audit-remediation/F2-code-review.md`.
- [ ] F3. Real manual QA
      Drive the real app-host floor-plan route at 375x812, 846x900, 1280x900, and one 320-430px narrow canvas. Exercise table select/deselect, mobile sheet open/close, keyboard focus, zoom controls, filter clear, scrubber keyboard/pointer, and no horizontal overflow. Evidence: screenshots, trace/video if available, and `.omo/evidence/floor-plan-audit-remediation/F3-real-route-qa.md`.
- [ ] F4. Scope fidelity
      Confirm final diff is limited to the approved Micro-Spec blast radius or record user approval for any widened path. Confirm unrelated dirty files are unchanged from the initial ledger. Evidence: `.omo/evidence/floor-plan-audit-remediation/F4-scope-fidelity.md`.

## Commit strategy

- Use small commits by completed todo if executing manually; otherwise a final grouped PR can squash them.
- Recommended commit order:
  1. `docs(ops): add floor plan audit remediation spec`
  2. `fix(floor-plan): compact mobile summary and loading layout`
  3. `fix(floor-plan): expose readable service scrubber values`
  4. `fix(floor-plan): harden mobile map touch targets`
  5. `fix(floor-plan): improve floor plan semantics and focus`
  6. `test(floor-plan): cover audited edge states`
  7. `test(floor-plan): add audit closure evidence`
- Before staging, run `git diff --check` and inspect `git diff --name-only` against the allowed blast radius.
- Do not include unrelated dirty auth/env/security files in the floor-plan commit.

## Success criteria

- A valid active Micro-Spec exists for the floor-plan audit remediation and `pnpm guard:micro-specs` passes.
- Every audit issue from `.audit/floor-plan/AUDIT_BRIEF.md:79-104` has one of: fixed with source/test/browser proof, already satisfied with proof, or an explicit accepted exception.
- Mobile 375x812 has no dangling header separator, no horizontal overflow, compact stats, and the floor map is reachable without excessive pre-map scrolling.
- Table selection on touch has a usable target strategy even when visible table tiles are transformed; accidental touch drag does not persist layout changes.
- TimeScrubber exposes a human-readable service time and no 13-digit epoch value in accessibility proof.
- Floor-plan controls have visible, contrast-safe focus indication and preserve status text labels alongside color.
- Loading, empty, error, selected, unselected, filtered, and long-label states are covered by tests or browser evidence.
- Focused floor-plan Vitest, `pnpm guard:no-shadcn:strict`, `pnpm guard:luma:strict`, `pnpm typecheck`, `pnpm lint`, and real app-host Playwright/manual QA all pass or record clearly pre-existing failures.
- Final diff stays inside the approved blast radius and leaves unrelated dirty files alone.
