# Guest booking wizard responsive redesign - Work Plan

## TL;DR (For humans)

**What you'll get:** A calmer, mobile-first booking experience from planning through confirmation, plus a visually aligned but independently routed thank-you page. The shared design will remain usable in the customer website, the standalone Reserve app, and the denser operations booking flow.

**Why this approach:** The work is divided by stable component ownership, with each slice proving its behavior before and after the visual change. The final browser pass measures overlap, overflow, focus, touch targets, zoom, motion, and consumer-specific themes instead of treating screenshots as proof by themselves.

**What it will NOT do:** It will not change booking rules, schemas, APIs, availability or capacity logic, tenant boundaries, consent behavior, route proxying, or database code. It will not redirect guest Confirmation to the thank-you page, enable dark mode on the public site, or reuse the old divergent redesign branches wholesale.

**Effort:** XL
**Risk:** Medium - the change is presentation-only, but the UI is shared by three live consumers and includes fixed navigation, responsive geometry, consent-adjacent fields, and terminal booking states.
**Decisions to sanity-check:** Progress moves into normal page flow; the bottom rail keeps summary and actions only; shipped guest stays light-only while standalone Reserve proves dark mode; real Chrome 200% zoom is required for READY.

Your next move: execution is approved by the active goal. Pause and re-plan only if a boundary or readiness trigger below fires.

---

> TL;DR (machine): XL/medium-risk presentation-only redesign with TDD-owned shell and step slices, three-consumer integration, independent thank-you alignment, and measured cross-breakpoint browser proof.

## Scope

### Must have

- One coherent guest composition at 320x568, 375x812, 768x1024, and 1440x900: one page gutter, compact unboxed venue context, normal-flow progress, one primary step surface, semantic grouping, bounded desktop form width, and a sticky summary/action rail that cannot cover content.
- Production `WizardProgress` mounted in normal flow; no duplicate circular progress meter in the sticky rail.
- Existing live `--pg-*` tokens, imported public-guest utilities, root shadcn primitives, and defined shadow tokens only. Replace undefined `--pg-shadow-soft` and `--pg-shadow-floating`; do not add aliases.
- Preserve `data-booking-wizard-navigation`, ResizeObserver height reporting, safe-area padding, layout scroll padding, inert expanded content, Escape collapse, and prior-completed-step navigation before Confirmation.
- Plan: vertical on small phones, intentional two-column grouping only where space permits, 44px controls, preserved loading/empty/closed/full/advisory/date-move states.
- Details: bounded single column, clear email-or-phone requirement, fresh unchecked consent, phone-change WhatsApp reset, auth locks, readable terms/preferences, and 44px controls.
- Review: mobile-safe summary, direct component coverage, 44px Edit actions, readable safe errors and capacity alternatives.
- Confirmation: reference-first hierarchy, wrapped calendar/maps/print actions, guest terminal semantics, ops action/density semantics.
- Thank-you: independently routed card/page aligned with the wizard, with no new transition from Confirmation.
- Consumer proof for shipped guest, standalone Reserve, shipped ops, dev ops Confirmation harness, and relevant direct Review/error/capacity harnesses. Orphan/legacy wrappers are inspection-only unless a live importer is proved.
- Final evidence from final HEAD with deterministic synthetic fixtures, checksums, PII-safe artifacts, all repository gates, and unanimous independent F1-F4 approval.

### Must NOT have (guardrails, anti-slop, scope boundaries)

- No changes to schemas, reducer/context/store, draft storage, booking APIs, availability/capacity services, RPCs/migrations, tenant scoping, provider logic, route proxying, marketing navigation/footer, or global public-site theme ownership.
- No activation of the inert guest `returnPath`; customer Confirmation remains terminal and does not navigate to thank-you.
- No new booking steps, API fields, occasion productionization, decorative primitive/token systems, undefined elevation aliases, gradients, excessive nested cards/pills, or desktop density that degrades mobile.
- No behavior port from old redesign branches, wholesale cherry-pick/merge, stale screenshots, generated `dist`, `next-env.d.ts` drift, secrets, or real guest data.
- Do not edit `docs/design-system.md` unless a reusable token, primitive, or system rule genuinely changes. Feature requirements belong in this plan and tests.

### Authoritative file allowlist

- Product UI: `reserve/features/reservations/wizard/ui/**`; `reserve/.storybook/main.ts`; `src/components/restaurants/PublicSections.tsx`; `src/app/(public)/(marketing)/restaurants/[slug]/book/thank-you/page.tsx`.
- Consumer adapters only when required: `reserve/pages/WizardPage.tsx`; `src/components/features/booking/wizard/ReservationWizardClient.tsx`; `src/app/app/(app)/new-bookings/_components/OpsGuestBookingWizard.tsx`; `src/app/app/(app)/new-bookings/_components/WalkInWizardClient.tsx`.
- Tests only: existing or focused new files under `tests/reserve/**`, `tests/components/WizardNavigation-*.test.tsx`, `tests/guest/public-booking-message-pages.test.tsx`, and booking-specific `tests/e2e/**` helpers/specs.
- Planning state: `.omo/plans/guest-booking-wizard-responsive-redesign.md`, `.omo/drafts/guest-booking-wizard-responsive-redesign.md`, and branch-local `.omo/boulder.json` with the unrelated record preserved.
- Any required product edit outside this allowlist is a re-planning event before the edit.

## Verification strategy

> Zero human intervention - all verification is agent-executed.

- Test decision: strict RED -> GREEN -> REFACTOR with Vitest/jsdom per behavior-changing todo, then Playwright and real-browser visual/manual proof.
- Evidence root: `test-results/booking-wizard-responsive-redesign/<head>/`. This is task-owned and must not use or mutate the unrelated WhatsApp worktree or its evidence.
- Every artifact manifest records HEAD, route, consumer, viewport, state, timestamp, exact command, result, SHA-256 checksum, and redaction review.
- Use deterministic synthetic restaurant/guest fixtures only. Redact names, email, phone, booking references, tokens, authorization headers, provider payloads, and secrets from screenshots, traces, console/network logs, filenames, and reports.
- Component tests assert DOM, type-safe variants, ARIA, and preserved behavior. Browser tests additionally assert `scrollWidth <= clientWidth`, sticky-versus-content bounding boxes, target sizes, focus order/visibility, height-to-scroll-padding updates, action wrapping, safe-area behavior, Escape, reduced motion, and axe results.
- Screenshots are review artifacts, never the only acceptance evidence. Final screenshots/traces are regenerated and inspected at original resolution from final HEAD.
- Real 200% browser zoom must be set and read back through Chrome/browser computer control. CSS `zoom`, device scale factor, or a narrower viewport is not accepted. If actual zoom cannot be proved, verdict is NOT READY.
- Theme truth: shipped guest proves light only because its layout removes `.dark`; standalone Reserve proves supported light and dark. Enabling shipped guest dark mode is out of scope and triggers re-planning.
- `pnpm verify` is required but insufficient; final commands also include explicit changed-file Prettier and Reserve ESLint, focused Vitest, Luma strict guard, Next build, Reserve build, Storybook build, relevant Playwright packs, and proportionate security regression.

## Execution strategy

### Parallel execution waves

- Wave 0: Todo 1 locks isolation, live-consumer/state matrix, deterministic fixtures, current-state baseline, and evidence contract. It is serialized because every later worker depends on it.
- Wave 1: Todos 2-5 run in isolated child worktrees from the same HEAD with disjoint shell ownership: layout; navigation/progress; step/panel; offline/skeleton. Each returns an atomic commit.
- Wave 2: Todo 6 integrates the four shell commits in the primary feature worktree, resolves only adapter seams, mounts progress in production, fixes Storybook discovery, and proves the whole shell.
- Wave 3: Todos 7-11 run in isolated child worktrees from the integrated shell HEAD: Plan, Details, Review, Confirmation, and independent thank-you. Step workers cannot modify shell files.
- Wave 4: Todo 12 integrates those commits and proves Next/Vite/ops adapters and direct harnesses. Defects in an owned step return to that task owner instead of being patched across boundaries.
- Wave 5: Todo 13 is the single browser-matrix owner to avoid conflicting servers and mutable fixtures.
- Wave 6: Todo 14 cleans task-generated runtime output, proves the allowlist, and runs every final repository gate from one final HEAD.
- Final wave: F1-F4 run read-only and in parallel. Any rejection invalidates stale evidence, returns to the owning todo, and requires all four reviews to rerun.

### Dependency matrix

| Todo | Depends on | Blocks | Can parallelize with |
| ---- | ---------- | ------ | -------------------- |
| 1    | none       | 2-14   | none                 |
| 2    | 1          | 6      | 3,4,5                |
| 3    | 1          | 6      | 2,4,5                |
| 4    | 1          | 6      | 2,3,5                |
| 5    | 1          | 6      | 2,3,4                |
| 6    | 2-5        | 7-14   | none                 |
| 7    | 6          | 12     | 8,9,10,11            |
| 8    | 6          | 12     | 7,9,10,11            |
| 9    | 6          | 12     | 7,8,10,11            |
| 10   | 6          | 12     | 7,8,9,11             |
| 11   | 6          | 12     | 7,8,9,10             |
| 12   | 7-11       | 13,14  | none                 |
| 13   | 12         | 14     | none                 |
| 14   | 13         | F1-F4  | none                 |

## Todos

> Implementation + Test = ONE todo. Never separate.

- [x] 1. Lock isolation, consumer/state ownership, deterministic fixtures, and the pre-change baseline
     Completion note: The contract, isolation boundary, and consumer/state matrix are encoded in this plan and its draft. Pre-change screenshots were not captured; that remains an explicit evidence gap for Todo 13 to close with fresh final-HEAD route proof.
     Task / method: Verify branch HEAD equals current `origin/main`; preserve the unrelated Boulder record; add a separate branch-local work record; write the exact consumer, state, file-ownership, fixture, route-mock, and evidence matrix. Capture current Plan, Details, Review, Confirmation, ops, loading/offline/error/capacity, and independently routed thank-you behavior at the four target widths using existing mocked routes/harnesses. Baseline must not create failing expectations for later tasks.
     Knowledge and why: architecture collector + independent verifier establish live consumers, terminal Confirmation, inert guest return path, and shared file seams; risk verifier establishes old branches are research-only.
     Owned / forbidden: own planning/Boulder and task evidence only; test-helper extraction is allowed only if behavior-neutral and self-green. Do not edit product UI or the unrelated worktree/evidence.
     Parallelization: Wave 0 | Blocked by: none | Blocks: 2-14.
     References: `.omo/boulder.json`; `src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx`; `src/components/features/booking/wizard/ReservationWizardClient.tsx`; `reserve/pages/WizardPage.tsx`; `src/app/app/(app)/new-bookings/_components/OpsGuestBookingWizard.tsx`; `src/app/app/(app)/new-bookings/_components/WalkInWizardClient.tsx`; `tests/e2e/guest-booking.spec.ts`; `tests/e2e/guest-reserve-routes.spec.ts`.
     Acceptance: manifest names every live consumer/state and exact owner; existing WhatsApp Boulder work record is semantically unchanged; baseline files contain no PII; `git diff --name-only origin/main...HEAD` is within planning/test-helper allowlist; existing touched helper tests are green.
     Verification / QA: `git rev-parse HEAD origin/main`; focused helper Vitest/Playwright smoke if helper code changed; render/current-state screenshots and geometry inventory at 320x568, 375x812, 768x1024, 1440x900. Evidence `test-results/booking-wizard-responsive-redesign/<head>/task-1/`.
     Re-plan trigger: live main moved materially, deterministic states cannot be reached without product changes, or any fixture requires real guest/provider data.
     Commit: Y | `docs(booking): lock responsive redesign contract`

- [ ] 2. Redesign `WizardLayout` under RED-GREEN-REFACTOR
     Task / method: Add RED tests for one mobile gutter, compact venue context, bounded readable desktop content, explicit normal-flow progress slot, surface-aware guest/ops spacing, and navigation-height-derived bottom/scroll padding. Implement the smallest compatible layout change; preserve main/div landmark semantics.
     Knowledge and why: verified nested gutters leave about 160px for inner controls at 320; `layoutSurface` currently owns outer shell only.
     Owned / forbidden: `reserve/features/reservations/wizard/ui/WizardLayout.tsx` and `tests/reserve/features/reservations/wizard/ui/WizardLayout.test.tsx`. Do not edit Container, Navigation, steps, hooks, or tokens.
     Parallelization: Wave 1 | Blocked by: 1 | Blocks: 6 | Parallel with: 3,4,5.
     RED: `pnpm exec vitest run tests/reserve/features/reservations/wizard/ui/WizardLayout.test.tsx` must fail only on new layout-contract assertions.
     GREEN: same command passes; `pnpm exec eslint --max-warnings=0 reserve/features/reservations/wizard/ui/WizardLayout.tsx tests/reserve/features/reservations/wizard/ui/WizardLayout.test.tsx`; `pnpm exec prettier --check` on both files.
     Acceptance / QA: semantic element preserved; one guest gutter; no nested hero card requirement; progress slot has stable DOM order before step content; ops layout remains denser; bottom and scroll padding use measured navigation height plus safe area.
     Re-plan trigger: required token/global CSS change or Container API cannot remain backward compatible.
     Evidence: `test-results/booking-wizard-responsive-redesign/<head>/task-2/` with RED and GREEN logs.
     Commit: Y | `feat(booking): simplify responsive wizard layout`

- [ ] 3. Redesign Navigation and mount-ready Progress under RED-GREEN-REFACTOR
     Task / method: Add RED tests for sticky summary/actions without duplicate progress, mobile wrapping, full-width wrapped primary action, 44px actions, bounded/scrollable expanded summary on short screens, inert/Escape semantics, completed-step navigation before Confirmation, and height observer behavior. Make `WizardProgress` the accessible normal-flow progress presentation and keep Navigation compatible for integration.
     Knowledge and why: production progress is currently a circular meter in fixed Navigation; `WizardProgress` has no live renderer; expanded summary can cover short screens.
     Owned / forbidden: `WizardNavigation.tsx`, `WizardProgress.tsx`, their stories/tests, `tests/components/WizardNavigation-resize-observer.test.tsx`, `tests/components/WizardNavigation-summary-sheet.test.tsx`. Do not edit Container/Layout/steps/hooks.
     Parallelization: Wave 1 | Blocked by: 1 | Blocks: 6 | Parallel with: 2,4,5.
     RED: focused Navigation/Progress Vitest files fail only on new contracts.
     GREEN: focused Vitest passes plus explicit ESLint/Prettier over owned files.
     Acceptance / QA: `data-booking-wizard-navigation` remains; ResizeObserver reports collapsed rail height and zero when hidden/unmounted; expanded region is inert when closed and closes on Escape; previous completed steps remain selectable only before Confirmation; no circular progress meter remains in the rail; labels/copy remain behaviorally unchanged.
     Re-plan trigger: preserving observer/scroll contracts requires hook or reducer edits.
     Evidence: `test-results/booking-wizard-responsive-redesign/<head>/task-3/` with RED/GREEN and story render proof.
     Commit: Y | `feat(booking): clarify wizard progress and action rail`

- [ ] 4. Flatten shared Step and Panel surfaces under RED-GREEN-REFACTOR
     Task / method: Add RED tests for a single primary step surface, semantic section grouping, guest/ops density hooks, 44px interaction affordance compatibility, focus visibility, and defined elevation tokens. Replace undefined shadow usages with existing token values and remove unnecessary nested-card styling without changing public component contracts.
     Knowledge and why: verified frame -> venue panel -> step card -> field cards causes cramped composition; shadow aliases are undefined in the live token graph.
     Owned / forbidden: `WizardStep.tsx`, `WizardPanel.tsx`, and their focused tests. Do not edit fields, Layout, Navigation, or global CSS.
     Parallelization: Wave 1 | Blocked by: 1 | Blocks: 6 | Parallel with: 2,3,5.
     RED/GREEN: focused `WizardStep.test.tsx` and `WizardPanel.test.tsx` run RED then GREEN; explicit ESLint/Prettier passes.
     Acceptance / QA: no undefined shadow reference remains in owned files; heading/description/alert semantics stay intact; new props are optional/type-safe; no new primitive/token; ops can remain visually denser without behavior forks.
     Re-plan trigger: a reusable system-wide token or primitive genuinely must change.
     Evidence: `test-results/booking-wizard-responsive-redesign/<head>/task-4/`.
     Commit: Y | `feat(booking): flatten wizard step surfaces`

- [ ] 5. Align offline and loading skeleton geometry under RED-GREEN-REFACTOR
     Task / method: Add RED tests for accessible offline messaging/actions and skeleton structures that mirror the final venue/progress/step/rail geometry at small and wide layouts. Implement presentation-only changes using live utilities and defined elevations.
     Knowledge and why: state surfaces must be included in the responsive contract and skeletons must not preserve the old nested-card geometry.
     Owned / forbidden: `WizardOfflineBanner.tsx`, `WizardSkeletons.tsx`, and focused tests. Do not edit networking/hooks, retry behavior, shell files, or tokens.
     Parallelization: Wave 1 | Blocked by: 1 | Blocks: 6 | Parallel with: 2,3,4.
     RED/GREEN: focused offline/skeleton Vitest run RED then GREEN; explicit ESLint/Prettier passes.
     Acceptance / QA: offline action/copy semantics preserved; loading skeleton has no undefined shadows and mirrors final regions; reduced-motion styles avoid shimmer/transition dependence; no retry behavior changes.
     Re-plan trigger: state recovery behavior rather than presentation is found broken.
     Evidence: `test-results/booking-wizard-responsive-redesign/<head>/task-5/`.
     Commit: Y | `feat(booking): align wizard loading and offline states`

- [ ] 6. Integrate the shared shell and production progress renderer
     Task / method: Apply the disjoint shell commits, add RED integration assertions in Container/BookingWizard, mount `WizardProgress` in normal flow, pass surface/mode density deliberately, preserve sticky-height wiring and announcements, and update Storybook discovery so chrome stories actually build. Resolve only shell seams; return owned defects to their task.
     Knowledge and why: `WizardContainer` is the composition seam; production currently never renders `WizardProgress`; Storybook discovers only Plan stories.
     Owned / forbidden: `WizardContainer.tsx`, `BookingWizard.tsx`, their focused tests, `reserve/.storybook/main.ts`, and integration-only story wiring. No step/hook/model/API edits.
     Parallelization: Wave 2 | Blocked by: 2-5 | Blocks: 7-14.
     RED: focused Container/BookingWizard tests fail for missing normal-flow progress and surface integration.
     GREEN: all shell/UI focused Vitest files pass; `pnpm storybook:build`; explicit ESLint/Prettier passes.
     Acceptance / QA: exactly one accessible progress presentation; sticky rail remains actions/summary; terminal Confirmation has no completed-step navigation; navigation height drives scroll padding; live announcements and loading/offline behavior remain; Navigation/Progress stories are in static Storybook index.
     Re-plan trigger: integration needs state/schema/hook changes or consumer-specific behavior forks.
     Evidence: `test-results/booking-wizard-responsive-redesign/<head>/task-6/`.
     Commit: Y | `feat(booking): integrate responsive wizard shell`

- [ ] 7. Redesign Plan and its field internals under RED-GREEN-REFACTOR
     Task / method: Add RED layout/ARIA tests, then compose party -> date -> time -> notes vertically at 320/375, use an intentional party/date grouping at 768 where width permits, and bound wide-screen content. Increase stepper/slot targets and replace undefined field shadows with defined tokens.
     Knowledge and why: existing Plan is labeled bento and over-nests panels; previous old-branch work changed pending availability behavior and must not be ported.
     Owned / forbidden: `PlanStep.tsx`, `plan-step/**` production files/stories and their tests. No shell, hooks, services, availability logic, schemas, or occasion productionization.
     Parallelization: Wave 3 | Blocked by: 6 | Blocks: 12 | Parallel with: 8-11.
     RED/GREEN: Plan/PlanStepForm/PartySize/Calendar24/Notes focused Vitest files run RED then GREEN; Storybook interactions/build pass; explicit ESLint/Prettier passes.
     Acceptance / QA: loading, empty, closed, full, advisory and auto-moved-date states retain copy/action semantics; screen-reader date-move announcement remains; pending availability behavior is unchanged; slots/stepper are >=44px; no OccasionPicker production import.
     Re-plan trigger: any required edit to availability hooks/services or behavior differs from current main.
     Evidence: `test-results/booking-wizard-responsive-redesign/<head>/task-7/`.
     Commit: Y | `feat(booking): redesign plan selection layout`

- [ ] 8. Redesign Details under RED-GREEN-REFACTOR
     Task / method: Add RED structural and target-size tests, then produce a bounded single-column contact/consent/preferences hierarchy that stays readable at 320px and preserves disabled/required/auth states.
     Knowledge and why: Details owns contact and consent-adjacent presentation, so behavior preservation must be executable rather than inferred visually.
     Owned / forbidden: `DetailsStep.tsx`, any new UI-only section extracted beside it, and `DetailsStep.test.tsx`. Do not edit schemas, hooks, consent persistence/versioning, reducers, API payloads, or auth logic.
     Parallelization: Wave 3 | Blocked by: 6 | Blocks: 12 | Parallel with: 7,9-11.
     RED/GREEN: Details focused Vitest runs RED then GREEN; explicit ESLint/Prettier passes.
     Acceptance / QA: email-only and phone-only remain valid; both-empty remains invalid; consent starts unchecked; changing phone clears WhatsApp opt-in; auth-locked fields remain locked; ops differences persist; required controls are >=44px; terms/preference text wraps without overflow.
     Re-plan trigger: visual work requires schema/hook/consent behavior changes.
     Evidence: `test-results/booking-wizard-responsive-redesign/<head>/task-8/`.
     Commit: Y | `feat(booking): clarify guest details hierarchy`

- [ ] 9. Redesign Review with direct component coverage under RED-GREEN-REFACTOR
     Task / method: Create the missing `ReviewStep.test.tsx` RED suite for rendered summary, edit controls, pending submit, safe server error, and capacity alternatives; then implement a mobile-safe ticket/summary layout with semantic sections and >=44px Edit controls.
     Knowledge and why: hook coverage is broad but direct Review rendering/state coverage is missing.
     Owned / forbidden: `ReviewStep.tsx`, new direct component test, and UI-only nearby helpers. Do not edit `useReviewStep`, submission/API/capacity logic, selectors, or shell.
     Parallelization: Wave 3 | Blocked by: 6 | Blocks: 12 | Parallel with: 7,8,10,11.
     RED/GREEN: new ReviewStep suite fails then passes; existing `useReviewStep.test.tsx` stays green; explicit ESLint/Prettier passes.
     Acceptance / QA: summary content rules unchanged; Edit returns to correct prior step; capacity alternative returns to Plan; safe errors and alternatives wrap without rail overlap; submit pending semantics unchanged; no guest PII enters logs/evidence.
     Re-plan trigger: rendering fix requires hook/API/capacity behavior changes.
     Evidence: `test-results/booking-wizard-responsive-redesign/<head>/task-9/`.
     Commit: Y | `feat(booking): redesign review summary`

- [ ] 10. Redesign Confirmation and actions under RED-GREEN-REFACTOR
      Task / method: Add RED tests for reference-first hierarchy, narrow action wrapping, feedback, status variants, guest/ops actions, print/calendar/maps behavior, and terminal semantics. Implement presentation-only changes.
      Knowledge and why: current layout is actions-first; guest Confirmation is terminal while ops has different actions and may redirect in the shipped consumer.
      Owned / forbidden: `ConfirmationStep.tsx`, `BookingConfirmationActions.tsx`, and focused tests. Do not edit confirmation hook/controller, reducer, return path, redirects, API, or selectors.
      Parallelization: Wave 3 | Blocked by: 6 | Blocks: 12 | Parallel with: 7-9,11.
      RED/GREEN: Confirmation/BookingConfirmationActions focused Vitest run RED then GREEN; explicit ESLint/Prettier passes.
      Acceptance / QA: reference is first meaningful success detail; confirmed/pending/updated variants remain; guest exposes only Start a new booking and never redirects to thank-you; ops keeps Back to bookings then Start a new booking; action links/ICS/print semantics unchanged and wrap at 320.
      Re-plan trigger: a desired flow requires controller/reducer/redirect changes.
      Evidence: `test-results/booking-wizard-responsive-redesign/<head>/task-10/`.
      Commit: Y | `feat(booking): prioritize confirmation reference`

- [ ] 11. Align the independently routed thank-you surface under RED-GREEN-REFACTOR
      Task / method: Add RED page/card tests for the new visual structure, authenticated/unauthenticated exits, missing restaurant handling, and absence of any wizard transition coupling. Update the independently routed card/page using live guest tokens and bounded responsive layout.
      Knowledge and why: thank-you is a separate route/card; aligning it visually must not invent a Done transition.
      Owned / forbidden: `src/components/restaurants/PublicSections.tsx` only around `ReservationThankYouCard`, the thank-you `page.tsx`, and `tests/guest/public-booking-message-pages.test.tsx` or a focused route test. No wizard hook/reducer/route-proxy/API changes.
      Parallelization: Wave 3 | Blocked by: 6 | Blocks: 12 | Parallel with: 7-10.
      RED/GREEN: thank-you focused Vitest fails then passes; explicit ESLint/Prettier passes.
      Acceptance / QA: direct route remains independently loadable; signed-in and signed-out actions preserve destinations; missing restaurant remains safe; no guest wizard redirect/Done copy added; 320-1440 content does not overflow.
      Re-plan trigger: page alignment requires marketing navbar/footer or global theme changes.
      Evidence: `test-results/booking-wizard-responsive-redesign/<head>/task-11/`.
      Commit: Y | `feat(booking): align restaurant thank-you surface`

- [ ] 12. Integrate shipped guest, standalone Reserve, ops, and direct harness consumers
      Task / method: Apply step/thank-you commits, add RED integration assertions for explicit guest/ops surfaces and all live consumers, make only adapter-level changes needed to pass density/theme/layout props, and prove the direct Review/error/capacity and dev ops Confirmation harnesses. Orphan wrappers remain inspection-only unless a live importer is found.
      Knowledge and why: shared UI reaches three real consumers; shipped ops redirects after success, so its Confirmation actions are observable through the dev harness.
      Owned / forbidden: allowed adapter files and their tests only; integration test files. Step/shell defects return to owner. No route proxy, API, state, schema, services, global theme, or marketing shell edits.
      Parallelization: Wave 4 | Blocked by: 7-11 | Blocks: 13,14.
      RED/GREEN: `ReservationWizard`, `WizardPage`, public wizard client, ops new-bookings and relevant harness tests fail then pass on explicit surface contracts; all affected Vitest files green; Next/Reserve typechecks green.
      Acceptance / QA: guest hospitality composition, Reserve supported light/dark, ops denser composition, ops redirect behavior, terminal guest Confirmation, and independent thank-you all remain truthful; no shared behavior fork.
      Re-plan trigger: consumer integration requires changing global dark-mode ownership, proxying, state, API, or an owned step file across boundaries.
      Evidence: `test-results/booking-wizard-responsive-redesign/<head>/task-12/`.
      Commit: Y | `feat(booking): integrate responsive wizard consumers`

- [ ] 13. Prove the full browser, responsive, accessibility, and state matrix from one owner
      Task / method: Extend existing booking E2E routes/helpers rather than duplicating mocks. Use deterministic synthetic restaurant/availability/create-booking fixtures. Run full shipped guest Plan -> Details -> Review -> terminal Confirmation at 375x812; representative Plan/Details/Review/Confirmation and independent thank-you checks at 320x568, 768x1024, 1440x900; ops and Reserve checks; loading/offline/empty/validation/server-error/capacity/recovery; keyboard-only completion; reduced motion; axe; light/dark according to real consumer support; actual Chrome 200% zoom with recorded readback.
      Knowledge and why: existing shipped journey has no viewport; existing screenshots hide Navigation; no current 320, 1440, real zoom, routed thank-you, or sticky geometry proof.
      Owned / forbidden: booking-specific `tests/e2e/**` specs/helpers and task evidence only. No production code. One server/matrix owner.
      Parallelization: Wave 5 | Blocked by: 12 | Blocks: 14.
      Acceptance assertions: `scrollWidth <= clientWidth`; Navigation does not overlap final control/error/alternative/focused element; rail height updates computed scroll padding; required controls/Edit actions >=44x44 CSS px; actions wrap and remain reachable; safe-area CSS is present/effective; focus order/visible focus/Escape work; reduced motion disables nonessential motion; axe has no serious/critical violations; guest light and Reserve light/dark pass; actual Chrome zoom reads 200% and remains usable.
      Commands / QA: relevant Playwright configs/specs plus browser/computer control for actual zoom and original-resolution inspection. Capture traces only on failure and redact before retention. Do not hide the sticky rail in proof screenshots.
      Re-plan trigger: deterministic shipped states require production mutation, actual zoom cannot be read back, or any matrix failure indicates behavior/state rather than presentation. An unprovable actual zoom yields NOT READY.
      Evidence: `test-results/booking-wizard-responsive-redesign/<head>/task-13/` with manifest and checksums.
      Commit: Y only for E2E/helper changes | `test(booking): prove responsive wizard matrix`

- [ ] 14. Run final cleanup, diff allowlist, builds, guards, and repository verification
      Task / method: Remove task-generated runtime output except the declared evidence root, regenerate the final manifest from HEAD, prove changed paths against the allowlist, and run all focused and broad gates serially. Do not fix unrelated baseline failures or broaden cleanup; attribute them and re-plan if they block truthful proof.
      Knowledge and why: root lint excludes Reserve, format:check excludes wizard files, and `pnpm verify` omits builds, Storybook, Playwright, Luma strict, and security regression.
      Owned / forbidden: test/evidence cleanup and narrowly scoped test/config fixes only. Product defects return to their owner. Preserve unrelated worktrees and Boulder record.
      Parallelization: Wave 6 | Blocked by: 13 | Blocks: F1-F4.
      Required gates: explicit `pnpm exec prettier --check` over every changed text file; explicit `pnpm exec eslint --max-warnings=0` over changed TS/TSX including Reserve/tests; all affected Vitest; `pnpm guard:luma:strict`; `pnpm typecheck`; `pnpm typecheck:strict`; `pnpm reserve:build`; `pnpm storybook:build`; `pnpm build`; relevant Playwright guest/Reserve/ops packs; `pnpm security:regression`; `pnpm verify`.
      Acceptance: all required gates pass from final HEAD; `git diff --name-only origin/main...HEAD` is entirely allowlisted; no schema/API/reducer/store/hook/service/availability/capacity/database/security/proxy/global-theme change; no PII/secrets/generated dist/next-env drift; worktree clean after intentional commits and ignored evidence.
      Re-plan trigger: any failure needs product changes outside its owner/allowlist, build requires unauthorized external mutation, or evidence cannot be redacted truthfully.
      Evidence: `test-results/booking-wizard-responsive-redesign/<head>/task-14/`.
      Commit: Y only for intentional cleanup/test metadata | `chore(booking): finalize responsive wizard proof`

## Final verification wave

> Runs read-only and in parallel after all todos. All four must APPROVE. Any rejection returns to the owning todo, invalidates affected evidence, and requires all four reviews to rerun from the new final HEAD. Do not declare READY or complete the goal until approval is unanimous and current.

- [ ] F1. Plan compliance audit - verify every requirement, invariant, RED/GREEN record, command, artifact manifest, actual-zoom proof, and re-plan decision against final HEAD.
- [ ] F2. Code quality/accessibility/security audit - review React correctness, strict typing, component boundaries, accessibility, defined tokens, tenant/security non-impact, and PII/logging safety; run narrow confirmation commands as needed.
- [ ] F3. Fresh real-route visual/manual QA - regenerate and inspect original-resolution guest/Reserve/ops/thank-you states at all widths, actual Chrome 200% zoom, keyboard, reduced motion, and supported light/dark without relying on prior screenshots.
- [ ] F4. Scope and evidence hygiene audit - prove allowlisted diff, terminal guest Confirmation, independent thank-you, no old-branch port, clean worktree, preserved unrelated Boulder/worktree, artifact checksums, and zero PII/secrets.

## Commit strategy

- Primary branch: `codex/guest-booking-wizard-responsive-redesign-20260715`, based on live `origin/main` SHA `878ee13611a0500ea0e154957075953efc18b009` at plan approval.
- Use isolated child branches/worktrees for parallel shell and step ownership. Each task returns one atomic commit; integrate by explicit commit SHA in dependency order. Never share a Git index between writers.
- Commit boundaries: contract/baseline; Layout; Navigation/Progress; Step/Panel; offline/skeleton; shell integration; Plan; Details; Review; Confirmation; thank-you; adapters; E2E; final test metadata.
- Stage explicit paths/hunks only. Never commit runtime evidence, `dist`, coverage, traces with sensitive data, `next-env.d.ts` drift, or unrelated `.omo` content.
- Each visual wave is independently revertible. Never force-push main and never merge/cherry-pick an old redesign branch wholesale.

## Success criteria

- One coherent, behavior-preserving composition works from Plan through terminal Confirmation, plus an independently routed visually aligned thank-you page.
- Guest, Reserve, and ops consumers retain their real behavior and appropriate density; shipped guest stays light-only and Reserve proves supported dark mode.
- 320x568, 375x812, 768x1024, 1440x900, keyboard, focus, safe areas, reduced motion, axe, loading/offline/error/capacity states, and actual Chrome 200% zoom have current measurable proof.
- Sticky navigation never covers actionable or focused content; no horizontal overflow; required controls are at least 44px; normal-flow progress is accessible and not duplicated.
- All behavioral invariants remain green, all required builds/guards/tests pass, the diff is allowlisted and PII-safe, and F1-F4 unanimously approve READY from final HEAD.
