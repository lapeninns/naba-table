---
slug: guest-booking-wizard-responsive-redesign
status: approved-for-execution
intent: clear
pending-action: execute .omo/plans/guest-booking-wizard-responsive-redesign.md
approach: Isolate from live origin/main, preserve behavior, redesign shared UI in TDD-owned waves, integrate each consumer, then regenerate browser and repository proof from final HEAD.
---

# Research and decisions: guest booking wizard responsive redesign

## Ground truth

- Execution base is `origin/main` at `878ee13611a0500ea0e154957075953efc18b009` in `/Users/amankumarshrestha/LapenInns Project/nabatableLP-guest-booking-wizard-responsive-redesign-20260715` on `codex/guest-booking-wizard-responsive-redesign-20260715`.
- The old `booking-redesign-804f94d3` and `booking-redesign-clean-integration-804f94d3` worktrees are divergent, dirty, and contain stale or behavior-changing work. They are research-only; do not merge or cherry-pick them wholesale and do not trust their evidence.
- The unrelated `whatsapp-review-production-release` Boulder record and worktree remain intact. This task may add its own work record only inside the isolated feature worktree.

## Consumer and behavior matrix

- Shared flow: `ReservationWizard -> BookingWizard/useReservationWizard -> WizardContainer -> WizardLayout + WizardNavigation -> BookingWizardStepContent -> Plan | Details | Review | Confirmation`.
- Shipped guest consumer: `/restaurants/[slug]/book` via `ReservationWizardClient`.
- Standalone Reserve consumer: `reserve/pages/WizardPage.tsx`.
- Shipped ops consumer: `/app/new-bookings` via `OpsGuestBookingWizard`; the dev `WalkInWizardClient` can expose the ops Confirmation state for QA.
- `layoutSurface` currently controls only outer shell layout. `mode` controls behavior and copy. Any new guest-versus-ops density distinction must be explicit and type-safe.
- Customer Confirmation is terminal. Guest submission does not navigate to the restaurant thank-you route; ops alone can redirect on success. The thank-you route is an independent surface and must stay independent.
- Preserve email-or-phone contact, fresh unchecked consent, WhatsApp reset after phone changes, authenticated-field locks, Plan date-move announcements, availability/capacity/offline/error behavior, completed-step back navigation before Confirmation, and all request/API/state/data contracts.

## Design decisions

- The live token graph is `src/app/globals.css` plus `styles/design-system/public-guest.tokens.css` and `public-guest.utilities.css`; use those tokens and root `components/ui` primitives. Do not build a parallel token or primitive system.
- Replace undefined `--pg-shadow-soft` and `--pg-shadow-floating` usages with an already-defined elevation token; do not add aliases.
- Remove nested frame/card/gutter accumulation. Mobile gets one page gutter, compact venue context, normal-flow progress, one step surface, semantic grouping, and fixed actions that never cover content.
- Production progress must be mounted explicitly; `WizardProgress` is currently story/test-only while shipped progress is the small circular meter inside fixed Navigation.
- Preserve `data-booking-wizard-navigation`, ResizeObserver height, safe-area padding, inert expanded content, Escape behavior, and keyboard/focus behavior.
- Plan remains vertical at 320/375; 768 may use party/date columns with time/notes full width; wide screens bound readable form width rather than adding dense card grids.
- Details stays a bounded single-column form. Review gets mobile-safe summary and 44px Edit controls. Confirmation becomes reference-first. Thank-you receives matching visual language without a new transition.
- Shipped Next guest pages force light mode. Dark-mode proof belongs to the standalone Reserve consumer unless scope is explicitly expanded to change public-site theme ownership. Reduced motion, forced colors, contrast, and 200% zoom remain cross-consumer checks.

## Test and evidence decisions

- Every behavior-changing task owns its RED test, implementation, and GREEN proof. No task creates a failing test for a later task.
- Component tests assert structure and contracts; Playwright asserts geometry (`scrollWidth <= clientWidth`, sticky-versus-last-control bounding boxes, minimum 44px actions), focus reachability/order, functional loading/error/offline/capacity recovery, and routed behavior. Screenshots alone are insufficient.
- Browser matrix: guest route at 320x568, 375x812, 768x1024, 1440x900; full guest journey at 375; representative step/state checks at the other widths; ops and standalone Reserve consumer checks after shared integration; independent thank-you route checks.
- Do not call CSS `zoom`, device scale factor, or a narrow viewport proof of 200% browser zoom. Use a real browser zoom control where automation supports it; otherwise record that exact gap and do not claim it passed.
- Shipped guest dark mode is not user-reachable. Prove light mode there and prove dark mode in standalone Reserve; changing public theme ownership is a re-planning event.
- Task-owned evidence lives under `test-results/booking-wizard-responsive-redesign/<head>/`, never the unrelated goal's evidence. It identifies final HEAD, route, consumer, viewport, state, timestamp, command, assertion result, and artifact checksum. Use synthetic fixture identities only; redact names, emails, phone numbers, booking references, tokens, headers, and provider data.
- Final proof is regenerated from final HEAD after cleanup. `pnpm verify` is required but not sufficient: also run explicit Prettier/ESLint for changed Reserve/test files, focused Vitest, Next build, Reserve build, Storybook build, Playwright packs, `pnpm guard:luma:strict`, and proportionate security regression.

## Re-planning triggers

- Any required edit to schemas, reducer/context, draft storage, availability/capacity services, booking APIs, database migrations/RPCs, tenant/security boundaries, marketing navigation/footer, or global public-site theme ownership.
- Any shared-file ownership collision between parallel tasks, broken consumer that requires modifying another task's owned production file, inability to produce deterministic shipped-route states, or browser tooling that cannot truthfully exercise a required acceptance criterion.
- Any discovered behavior drift, PII in artifacts/logs, undefined new token/primitive, unexplained baseline failure, or need to port code from an old redesign branch.

## Approval gate

status: approved-for-execution
source: the user explicitly asked to set the revised objective as a goal; goal continuation is approval to execute within these boundaries.
