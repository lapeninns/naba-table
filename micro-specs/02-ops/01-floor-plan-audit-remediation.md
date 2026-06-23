---
spec_id: MS-ops-floor-plan-audit-remediation
status: active
risk_class: ui-only
owner: agent:floor-plan
last_reviewed: 2026-06-23
allowed_blast_radius:
  - src/components/features/floor-plan/**
  - src/hooks/ops/useFloorPlanActions.ts
  - tests/components/floor-plan/**
  - src/app/(public)/dev/ops-floor-plan/**
  - micro-specs/02-ops/01-floor-plan-audit-remediation.md
  - .audit/floor-plan/AUDIT_BRIEF.md
  - .omo/plans/floor-plan-audit-remediation.md
  - .omo/evidence/floor-plan-audit-remediation/**
implementation_surfaces:
  - src/components/features/floor-plan/**
  - tests/components/floor-plan/**
related_docs:
  - .audit/floor-plan/AUDIT_BRIEF.md
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/README.md
  - .omo/plans/floor-plan-audit-remediation.md
related_tests:
  - tests/components/floor-plan/FloorPlanShell.test.tsx
  - tests/components/floor-plan/FloorPlanHeader.test.tsx
  - tests/components/floor-plan/FloorPlanCockpit.test.tsx
  - tests/components/floor-plan/TimeScrubber.test.tsx
  - tests/components/floor-plan/TableNode.test.tsx
  - tests/components/floor-plan/touchTargets.test.ts
verification_gates:
  - pnpm guard:no-shadcn:strict
  - pnpm guard:luma:strict
  - pnpm guard:micro-specs
  - pnpm typecheck
  - pnpm lint
  - pnpm exec vitest run tests/components/floor-plan
  - pnpm exec prettier --check src/components/features/floor-plan
approved_exceptions: []
---

# Floor Plan — Audit Remediation (ui-only)

> Source of truth for the user-visible outcomes is `.audit/floor-plan/AUDIT_BRIEF.md`.
> Stack, security, UI-system, and verification baselines are owned by `GLOBAL_CONTEXT.md`
> and are referenced, not restated.

## 1. Exact Goal and User-Visible Outcomes

The shipped ops floor plan (`app` host, `src/app/app/(app)/floor-plan` → `FloorPlanClient` →
`FloorPlanShell`) is usable on phones, tablets, and desktop during service. A host/server can:

- read the page header on a phone with no dangling separator left behind when the status badge
  wraps to its own line;
- reach the floor map without excessive pre-map scrolling, with compact, screen-reader-grouped
  service stats;
- select any table by touch with a target of at least 44×44 CSS px even when tiles are rendered
  below 44px by the fit-scale transform, and never trigger a layout move by a touch tap/jitter;
- operate zoom controls that do not hide a table on a narrow canvas;
- hear a human-readable service time from the scrubber (no 13-digit epoch announced);
- navigate a meaningful heading/landmark outline for the map, service states, stats, and zones;
- see a clearly visible, contrast-safe keyboard focus indicator on floor-plan controls;
- keep status conveyed by dot **and** text label, never colour alone;
- see coherent loading, empty, error, selected, filtered, and long-label states.

## 2. Blast Radius: In Scope and Out of Scope

**In scope** (`allowed_blast_radius`): the floor-plan component tree, its component tests, the
dev-only preview harness, this spec, the audit brief, the work plan, and the evidence folder.

**Out of scope:** `src/proxy.ts`, auth/session code, Supabase clients, migrations, RLS/RPC,
booking lifecycle / capacity mutations, provider webhooks, analytics, notifications, ops dark
mode, and any new UI primitive system or component library (see `GLOBAL_CONTEXT.md` §2, §4, §5).
All unrelated dirty files are preserved untouched. Harness no-op actions, mock zone constants,
mock scrubber state, and the dev venue name are mock artifacts, not product bugs, and are not
"fixed".

## 3. Strict Constraints and Assumptions

- Build only on the existing shadcn/Luma primitive layer (`components/ui/**`) and the ops-shell
  patterns already used by the page; no parallel primitives (`GLOBAL_CONTEXT.md` §5).
- Ops is light-only by design; do not add dark mode.
- The global 44×44 button floor does not survive CSS-transform scaling, so transformed tiles need
  an unscaled/coarse-pointer hit-target strategy rather than a height bump.
- Internal scrubber math stays in epoch milliseconds; only the exposed accessibility values change.
- Final proof is the real authenticated app-host route; the dev harness is supplemental only.

## 4. Decisions Already Made

- Reconcile-first: the dirty tree already ships the bottom Sheet, `pan-y pinch-zoom`, 12px touch
  slop, viewport/projection math, compact cockpit, and human `aria-valuetext`; characterize those
  before adding code and implement only the remaining gaps.
- Touch tap → select only; pointer drag-to-move stays on fine pointers (mouse/pen) so a touch
  never commits a silent layout edit.
- Keyboard focus uses a local cobalt (`--primary`) focus ring on floor-plan controls instead of
  the low-contrast mid-gray `--ring`.
- Stat tiles and the major sections gain accessible grouping/headings without adding visible
  instructional text.

## 5. Behavioral Requirements Using EARS Notation

- WHEN the page header renders and the "Service operational" badge wraps below the summary on a
  narrow viewport, THE header SHALL NOT leave a standalone separator glyph dangling on the summary
  line.
- THE service-stat cockpit SHALL expose an accessible group whose name conveys the service summary,
  and each stat tile SHALL tie its number, label, and detail into one accessible unit.
- WHERE a table tile is rendered below 44 CSS px by the fit-scale transform, THE floor map SHALL
  provide a touch hit target of at least 44×44 CSS px for selecting that table on coarse pointers,
  without altering the visible tile geometry.
- WHEN a table is interacted with by a touch pointer, THE map SHALL select the table and SHALL NOT
  commit a position/layout mutation, regardless of touch movement.
- WHILE a fine pointer (mouse/pen) is used by an admin, THE map SHALL preserve drag-to-move for
  movable, in-service tables.
- THE zoom controls SHALL be presented as an elevated cluster that does not obscure table content
  on narrow canvases, and MAY hide the zoom-percent chip at the smallest widths.
- THE service-time slider SHALL expose `aria-valuemin`/`aria-valuemax`/`aria-valuenow` as
  service-window minute offsets (not raw epoch ms) and SHALL keep a human-readable
  `aria-valuetext`; no accessible name/value/description SHALL contain a 13-digit epoch.
- THE slider SHALL preserve pointer scrubbing and Arrow/Page/Home/End keyboard stepping with
  minute-rounded callbacks.
- THE floor map title, service-states strip, cockpit, and zone-occupancy summary SHALL carry
  meaningful headings/landmarks to strengthen the document outline.
- THE floor-plan interactive controls (table nodes, scrubber, zoom controls, filter chips, sheet
  actions) SHALL show a visible, contrast-safe keyboard focus indicator.
- THE table button accessible name SHALL include its service-state label, and status SHALL be
  conveyed by dot plus label, never colour alone.
- THE loading skeleton SHALL mirror the map-first layout and SHALL NOT show the desktop aside
  below the `lg` breakpoint; the empty, error, selected, filtered, and long-label states SHALL
  render without console errors or horizontal overflow.

## 6. Verification Criteria and Task Breakdown

**Acceptance (observable):**

- Focused floor-plan Vitest passes: `pnpm exec vitest run tests/components/floor-plan`.
- `pnpm guard:no-shadcn:strict`, `pnpm guard:luma:strict`, `pnpm guard:micro-specs`,
  `pnpm typecheck`, `pnpm lint`, and `pnpm exec prettier --check src/components/features/floor-plan`
  pass or record pre-existing, unrelated failures.
- Real authenticated route proof at `http://app.localhost:3000/floor-plan` for mobile (375×812),
  tablet (846×900), desktop (1280×900), and one 320–430px narrow canvas: no horizontal overflow,
  clean console, human scrubber value, visible focus, correct table select → aside/sheet, touch
  targets meeting the strategy (or a recorded approved exception), and zoom controls clear of a
  table centre. Evidence under `.omo/evidence/floor-plan-audit-remediation/`.

**Behaviors covered by tests:** header has no orphan separator element; cockpit exposes a service
summary group with tied number/label/detail; touch hit-target helper computes ≥44px boxes; a
sub-threshold and a supra-threshold touch never fire a layout mutation; keyboard activation still
selects movable tables; scrubber exposes numeric minute-offset `aria-valuenow` + human
`aria-valuetext` with no 13-digit epoch, and keyboard stepping rounds to the minute; selected
table opens the sheet below `lg` and the aside at `lg+`; status label appears in the table name;
loading skeleton hides the aside below `lg`; empty/active-filter/long-label states render cleanly.

**Task breakdown:** (1) characterization tests for accepted dirty behavior; (2) header + cockpit

- loading; (3) scrubber accessibility; (4) touch targets + zoom controls; (5) headings + focus +
  status semantics; (6) edge-state coverage; (7) integration + real-route proof + audit closure.
