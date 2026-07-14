# Task 2: WhatsApp consent v2 verification

## Delivery mode

High-rigor Red -> Green implementation under `MS-guest-whatsapp-review-consent`.

## Baseline characterization

- Added characterization coverage for `booking-transactional-v1` and the original booking-only
  consent wording.
- `pnpm exec vitest run tests/server/booking-whatsapp-consent.test.ts
tests/reserve/features/reservations/wizard/ui/steps/DetailsStep.test.tsx` passed 22/22 before
  production changes.

## RED evidence

- Consent-v2 version, copy, lifecycle/review eligibility, phone mismatch, and reminder exclusion:
  6 expected failures, 21 passes. The failures showed v1 still persisted, the eligibility function
  absent, and the expanded guest/ops copy absent.
- Actor/source boundary slice: 3 expected failures, 10 passes. Missing ops actors, forged guest
  actors, and invalid stored attribution were still accepted.
- Scannable-copy slice: 2 expected failures, 15 passes. The three lifecycle/review purposes were
  not exposed as separate readable items.
- Independent correction slice: 3 expected unit failures proved the initially chosen v2 ID was
  not the locked `booking-plus-review-v2`; shipped-route RED also reproduced the generic
  `the restaurant` identity and oversized checkbox control before the fixes.

## GREEN evidence

- Focused consent/UI suite: 30/30 passed.
- Consent implementation regression set: 92/92 passed across consent, request validation, create
  payload/completion, public and ops routes, Reserve hooks/reducer, and Details UI.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with five pre-existing `no-explicit-any` warnings outside this spec.
- `pnpm guard:luma:strict`: passed its baseline ratchet.
- `pnpm guard:micro-specs`: passed with 31 active specs.
- `QA_EXTERNAL_MUTATION_MODE=dry-run pnpm qa:observability-privacy`: 51/51 passed.
- Scoped Prettier and `git diff --check`: passed.
- `pnpm build`: passed after temporarily linking the ignored main-checkout `.env.local`; the link
  was removed immediately after the build.
- `pnpm test --maxWorkers=8`: 1,241 files passed; 5,851 tests passed and 5 skipped. The bounded
  worker replay avoids the planner-stress timeout seen under the machine's default concurrent load.
- The programming skill's no-excuse scanner passes the six directly changed consent/UI/test files.
  When expanded to `useReservationWizard.ts`, it reports two pre-existing catch-narrowing findings
  at lines 537 and 580; neither catch is part of the venue hydration correction.

## Manual shipped-route QA

Surface: `playwright.reserve.config.ts` on the real `/r/:restaurantSlug` Reserve route with its
existing route fixtures.

- 375 x 812: observed unchecked consent, explicit `Nabatable on behalf of The Fox` wording,
  scannable lifecycle and single-review purposes, SMS fallback boundary, keyboard Tab focus, and
  Space-key opt-in. The visual checkbox is at most 20 x 20px while its label/card remains at least
  44px high as the touch target. The 375 artifact is a full 375 x 812 shipped-route viewport, not a
  component crop.
- Changed the valid phone after opt-in and observed consent clear immediately; reacceptance was
  required.
- 768 x 900: observed the review summary
  `WhatsApp booking messages + one post-visit review request · SMS backup for booking messages`.
- The route continued through the real capacity-alternative response and passed.
- Evidence: `task-2-whatsapp-review-production-release-375.png` and
  `task-2-whatsapp-review-production-release-768.png` in this folder.
- Authenticated ops route: `playwright.app.config.ts` smoke passed and proved the real
  `app.localhost/new-bookings` wizard mounts. Its existing test stops at the plan step; extending
  browser interaction into Details would require editing `tests/e2e/ops-new-bookings.spec.ts`,
  which is outside this Micro-Spec radius. The in-radius Details component contract separately
  proves the ops wording and unchecked state.

## Adversarial audit

- Malformed phone: server consent builder rejects it; UI disables consent for invalid UK phones.
- Stale consent: fresh forms stay unchecked; a phone change clears accepted consent.
- Forged source/missing actor: eligibility fails closed; persistence rejects guest actor injection
  and ops consent without an authenticated actor.
- v1/no backfill: v1 remains lifecycle-only, review-ineligible, and no migration/backfill was added.
- Reminder leakage: consent model always rejects WhatsApp reminders.
- Dirty worktree: other workers' ledger/redirect files were present and left untouched; this slice
  only edited its governed consent/UI/test paths and this task artifact.
- Flake/misleading success: the default-concurrency capacity stress timeout was retained as a
  diagnostic observation; the complete bounded-worker suite is separately reported and green.
- Network/offline, localization, time-zone, and destructive remote mutation classes are not
  applicable: this slice changes local consent copy/model behavior and performs no remote writes.

## Cleanup receipt

- Playwright web server on port 5174: stopped; no listener remained.
- Temporary `.env.local` link: removed.
- Browser traces/videos: none retained because the final scenario passed.
- The three `.omo/evidence/task-2-whatsapp-review-production-release*` artifacts are explicitly
  listed in the active Micro-Spec process radius and are visible to Git for commit.
