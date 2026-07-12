---
spec_id: MS-guest-wizard-nav-summary-sheet
status: active
risk_class: ui-only
owner: amankumarshrestha
last_reviewed: 2026-07-12
allowed_blast_radius:
  - reserve/features/reservations/wizard/ui/WizardNavigation.tsx
  - reserve/features/reservations/wizard/ui/WizardProgress.tsx
  - reserve/features/reservations/wizard/ui/types.ts
  - reserve/features/reservations/wizard/ui/WizardContainer.tsx
  - reserve/features/reservations/wizard/model/selectors.ts
  - reserve/features/reservations/wizard/ui/__stories__/WizardNavigation.stories.tsx
  - reserve/dev/**
  - scripts/check-no-shadcn.mjs
  - .claude/launch.json
  - tests/components/WizardNavigation-resize-observer.test.tsx
  - tests/components/WizardNavigation-summary-sheet.test.tsx
  - tests/reserve/features/reservations/wizard/model/selectors.test.ts
  - micro-specs/guest/wizard-nav-summary-sheet.md
  - micro-specs/evidence/MS-guest-wizard-nav-summary-sheet.json
implementation_surfaces:
  - reserve/features/reservations/wizard/ui/WizardNavigation.tsx
  - reserve/features/reservations/wizard/ui/WizardProgress.tsx
  - reserve/features/reservations/wizard/ui/types.ts
  - reserve/features/reservations/wizard/model/selectors.ts
  - tests/components/WizardNavigation-summary-sheet.test.tsx
  - tests/reserve/features/reservations/wizard/model/selectors.test.ts
related_docs:
  - AGENTS.md
  - reserve/AGENTS.md
related_tests:
  - tests/components/WizardNavigation-resize-observer.test.tsx
  - tests/components/WizardNavigation-summary-sheet.test.tsx
  - tests/reserve/features/reservations/wizard/model/selectors.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm guard:no-shadcn:strict
  - pnpm guard:luma:strict
  - pnpm typecheck
  - pnpm lint
  - pnpm test
  - pnpm build
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - Real-route browser QA screenshots (AGENTS.md UI rule) — the redesigned bar on the guest route /restaurants/[slug]/book AND the ops walk-in (/new-bookings), at 320px and 390px, showing collapsed + expanded, in light and dark. The reserve/dev harness does not count as proof.
approved_exceptions: []
---

# MS-guest-wizard-nav-summary-sheet — Booking wizard bottom-nav: summary-sheet redesign

## 1. Exact Goal and User-Visible Outcomes

A guest booking a table (and an ops user taking a walk-in) sees a redesigned
fixed bottom navigation bar. In its default (collapsed) state the bar is a
single compact row — a circular step-progress indicator (e.g. "2/4"), the
current step name, a one-line booking summary, and the step's Back / primary
actions — that fits a 320px phone without horizontal overflow. Tapping the
summary expands a sheet upward that reveals the booking facts as a labeled grid
(Date, Time, Party, Service, and Notes when present) plus any support actions
(e.g. Add to calendar / Add to wallet on confirmation), without leaving the
step. The bar is legible at every width from 320px up, works with keyboard and
screen readers, honors reduced-motion, and renders correctly in light and dark.

This replaces the current stacked layout (centered summary line over a
step-pill + progress bar + buttons) whose progress bar is hidden on mobile and
whose actions wrap awkwardly at 320px.

## 2. Blast Radius

**In scope (edit):**

- `WizardNavigation.tsx` — rewrite to the collapsed/expandable summary-sheet layout.
- `WizardProgress.tsx` — `WizardSummary` type gains an optional `facts` field (shared `SummaryFact` type: `{ label, value }`).
- `types.ts` — `WizardNavigationProps` stays shape-compatible (facts flow via `summary`).
- `WizardContainer.tsx` — pass-through only; adjust only if `facts` needs threading (it rides on `summary`, so likely no change).
- `model/selectors.ts` — `createSelectionSummary` also emits `facts` derived from `BookingDetails`.
- `__stories__/WizardNavigation.stories.tsx` — update story args to the new shape.
- Tests listed in `related_tests` / `implementation_surfaces`.

**Out of scope:** the wizard step bodies (Plan/Details/Review/Confirmation
content), the reducer/booking data model, availability/capacity/API, the
`reserve/dev/**` harness (prototype only — it stays but is not shipped proof),
the reserve Vite standalone build/CSS pipeline (production renders these
components through Next, which already provides Tailwind), and any DB/auth.

## 3. Strict Constraints and Assumptions

- **Primitive layer.** Reuse the shared shadcn primitive `@/components/ui/button`
  (`guest-primary` / `guest-outline` / `guest-ghost` variants) for actions — no
  bespoke button/base primitives (satisfies `guard:no-shadcn:strict`,
  `guard:luma:strict`). The reserve/dev prototype's local `ActionButton` is NOT
  carried into production.
- **Design tokens.** Style only with Radix Luma tokens already in scope
  (`--pg-*`, semantic `bg-primary`/`text-foreground`/etc.); no new colors, no
  hard-coded hex. Theme-aware light + dark.
- **Props compatibility.** `WizardNavigationProps` keeps its existing fields
  (`steps, currentStep, summary, actions, visible, onHeightChange, className`);
  `facts` is added as an optional field on `WizardSummary`, so the container
  wiring is unchanged. `onHeightChange` continues to report the collapsed
  footprint (existing resize-observer test must stay green).
- **Shared component.** The same `WizardNavigation` renders for `mode:'customer'`
  (guest) and `mode:'ops'` (walk-in); the redesign applies to both. No
  mode-based divergence.
- **Assumption (surfaced, contradicts an earlier ask):** `BookingDetails` has no
  `occasion` field, so Occasion is NOT shown in the facts grid; adding it would
  require a data-model change outside this UI-only radius (possible follow-up).
  Facts = Date, Time, Party, Service, and Notes (each only when non-empty).
- **Rendering context.** Production renders these components inside Next
  (`/restaurants/[slug]/book` → `ReservationWizardClient` → `ReservationWizard`),
  where `src/app/globals.css` provides Tailwind v4 (auto content-detection). No
  pipeline change is required or in scope.

## 4. Decisions Already Made

- Chosen design = "Direction C — summary sheet" (of three prototyped in
  `reserve/dev`); collapsed peek + upward-expanding facts sheet.
- Collapsed peek shows: circular progress ("N/total"), step label, one-line
  summary (`details` joined, truncated), then Back (secondary) + primary action.
- Expanded sheet shows: labeled facts grid + support actions; a mobile-only drag
  handle; on ≥sm the peek and actions sit on one row and the primary is
  auto-width.
- The sheet auto-collapses on step change; Escape collapses; the disclosure uses
  `aria-expanded` + `aria-controls`; the panel is a labeled `region`.
- Progress fraction = `currentStep / totalSteps` (25% at step 1 → 100% at the
  end), an intentional change from the old `(current-1)/(total-1)`.
- Facts are produced by `createSelectionSummary` (single source), not re-derived
  in the view from the `details` string array.
- The `reserve/dev` prototype harness (where the 3 directions were explored) is
  kept for future nav iterations. Because it uses `<iframe>` device frames and a
  neutral non-guest chrome by design, it cannot satisfy the shipped-UI shadcn
  guard, so `dev`/`__dev` harness directories are exempted in
  `scripts/check-no-shadcn.mjs` — consistent with AGENTS.md treating `/dev/**`
  as supplemental, non-shipped surface (like `__stories__`/`__tests__`, which the
  guard already skips).

## 5. Behavioral Requirements (EARS)

- THE wizard bottom navigation SHALL render a fixed bottom bar containing a circular step-progress indicator, the current step label, a one-line booking summary, and the current step's actions.
- WHILE the summary sheet is collapsed, THE navigation SHALL fit within a 320px-wide viewport with no horizontal overflow.
- WHEN the user activates the summary disclosure control, THE navigation SHALL expand a panel that reveals the booking facts as a labeled grid plus any support actions.
- WHEN the user activates the disclosure control while the panel is expanded, THE navigation SHALL collapse the panel.
- WHEN the user presses Escape while the panel is expanded, THE navigation SHALL collapse the panel.
- WHEN the current step changes, THE navigation SHALL collapse the summary panel.
- THE disclosure control SHALL expose `aria-expanded` and `aria-controls` referencing the panel, and the panel SHALL be a labeled region.
- IF the booking facts list is empty, THEN THE navigation SHALL omit the disclosure control and render the summary as static text.
- THE navigation's interactive controls SHALL each present a touch target of at least 44x44 CSS pixels.
- WHILE the user prefers reduced motion, THE navigation SHALL disable the expand/collapse and progress transitions.
- WHEN an action is in a loading state, THE navigation SHALL show a spinner on that action and disable it.
- THE navigation SHALL report its collapsed height through `onHeightChange` when mounted and on resize.
- THE booking selection selector SHALL produce a `facts` list of `{label,value}` from `BookingDetails`, including Date, Time, Party, Service, and Notes, and SHALL omit any entry whose value is empty.

## 6. Verification Criteria and Task Breakdown

**Observable criteria**

- On the real guest route `/restaurants/[slug]/book` at 320px and 390px: the collapsed bar shows progress + step + summary + Back/primary, with no horizontal overflow; a long summary truncates.
- Tapping the summary expands the facts grid with correct labels (Details/Review → Date/Time/Party/Service[/Notes]; Confirmation → Reference/When/Party + calendar/wallet); tapping again or pressing Escape collapses it; advancing a step collapses it.
- Keyboard: the disclosure is focusable, toggles `aria-expanded`, and Escape closes it; the screen-reader step announcement still fires.
- Dark mode renders via tokens; reduced-motion disables transitions.
- The ops walk-in wizard (`/new-bookings`) shows the same redesigned bar.
- `tests/components/WizardNavigation-resize-observer.test.tsx` stays green.

**Task breakdown (test-first, one at a time)**

1. RED `tests/reserve/selection-facts.test.ts`: `createSelectionSummary` returns a `facts` array (Date/Time/Party/Service; omits empty Notes). GREEN in `model/selectors.ts` + `WizardProgress.tsx` (`SummaryFact`, `WizardSummary.facts`).
2. RED `tests/components/WizardNavigation-summary-sheet.test.tsx`: collapsed renders peek + actions; activating the disclosure toggles `aria-expanded` and reveals the facts region; Escape + step-change collapse; empty facts → no disclosure. GREEN by rewriting `WizardNavigation.tsx` (reuse `@/components/ui/button`, Luma tokens).
3. Keep the resize-observer test green (height reporting on the collapsed footprint).
4. Update the story to the new shape.
5. Run gates via `governance:run-gates --spec MS-guest-wizard-nav-summary-sheet --record`; capture real-route browser QA screenshots (guest + ops, 320/390, collapsed/expanded, light/dark); advance to `implemented` then `verified`.
