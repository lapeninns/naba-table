---
spec_id: MS-foundation-tag-debt-cleanup
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/foundation/**
  - micro-specs/evidence/**
  - tests/cloudflare/sms-summary-gateway.test.ts
  - tests/config/env-schema-target.test.ts
  - tests/lib/auth/redirects-hostname.test.ts
  - tests/lib/twilio-sms.test.ts
  - tests/micro-specs/mobile-notification-ledger.test.ts
  - tests/qa/ops-auth-fixture.test.ts
  - tests/reserve/buildReservationDraft.test.ts
  - tests/reserve/detailsFormSchema.test.ts
  - tests/reserve/plan-step-past-current-date.test.tsx
  - tests/scripts/validate-env-local-routing.test.ts
  - tests/server/auth/signin-route-ops-redirect.test.ts
  - tests/server/booking-create-completion.test.ts
  - tests/server/booking-whatsapp-consent.test.ts
  - tests/server/emails/sender-policy.test.ts
implementation_surfaces:
  - micro-specs/foundation/tag-debt-cleanup.md
  - tests/cloudflare/sms-summary-gateway.test.ts
  - tests/config/env-schema-target.test.ts
  - tests/lib/auth/redirects-hostname.test.ts
  - tests/lib/twilio-sms.test.ts
  - tests/micro-specs/mobile-notification-ledger.test.ts
  - tests/qa/ops-auth-fixture.test.ts
  - tests/reserve/buildReservationDraft.test.ts
  - tests/reserve/detailsFormSchema.test.ts
  - tests/reserve/plan-step-past-current-date.test.tsx
  - tests/scripts/validate-env-local-routing.test.ts
  - tests/server/auth/signin-route-ops-redirect.test.ts
  - tests/server/booking-create-completion.test.ts
  - tests/server/booking-whatsapp-consent.test.ts
  - tests/server/emails/sender-policy.test.ts
related_docs:
  - docs/qa/foundation.md
related_tests:
  - tests/scripts/validate-env-local-routing.test.ts
  - tests/lib/auth/redirects-hostname.test.ts
  - tests/server/booking-whatsapp-consent.test.ts
  - tests/qa/ops-auth-fixture.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm test
  - pnpm lint
  - pnpm typecheck
  - pnpm run qa:foundation
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-foundation-tag-debt-cleanup — Clear committed QA tag-ratchet debt

## 1. Exact Goal and User-Visible Outcomes

`pnpm run guard:qa-tags` exits green on `main`. On 2026-07-11 the tag audit reported 14
committed test files whose untagged-title counts exceed the frozen per-file baseline in
`config/qa/tag-baseline.json` (74 untagged titles in those files overall). The drift
accumulated because the guard's CI job is path-filtered and direct pushes never trigger
it. This spec clears the drift by tagging; a separate spec
(MS-foundation-full-suite-ci-gate) closes the enforcement hole. Distinct from
MS-foundation-test-baseline-restoration, which fixed failing tests and the three
tag-debt files inside its own radius.

## 2. Blast Radius

In scope: exactly the 14 drifted test files listed in the frontmatter (title tag
suffixes only — no assertion, fixture, mock, or structural changes), this spec, and its
evidence ledger.

Out of scope: `config/qa/tag-baseline.json` (the ratchet is satisfied by tagging, never
by loosening the baseline; tightening it is optional follow-up work), `scripts/qa/*`,
all other test files, all product source.

## 3. Strict Constraints and Assumptions

- Only append `@tag` tokens to existing `it`/`test` titles; never rename the
  descriptive part of a title, and never change test behavior.
- Tags must come from the allowed vocabulary in `scripts/qa/tags.ts` and be accurate
  for what each test exercises (`@api`, `@security`, `@worker`, `@contract`,
  `@local-only`, …) — no blanket mis-tagging to appease the guard.
- Every previously-untagged title in the 14 files gets tagged (full clear, not just
  the over-baseline delta), so these files hold a zero-untagged standard.
- `pnpm test` must stay green — a title change cannot break behavior, but any test
  that asserts on its own suite titles would surface here.

## 4. Decisions Already Made

- Fully clear each drifted file rather than tagging only the delta above baseline.
- Trailing-tag format matching existing convention: `'<title> @api @security'`.
- The baseline file is not edited in this spec.

## 5. Behavioral Requirements (EARS)

- THE tag audit (`pnpm run guard:qa-tags`) SHALL pass with the existing baseline file
  unchanged.
- THE 14 drifted files SHALL contain zero untagged test titles.
- WHEN a title is tagged, THE tags SHALL be drawn from `scripts/qa/tags.ts` and
  reflect the test's actual surface.
- IF a file's tests exercise mixed surfaces, THEN THE tags SHALL vary per title
  rather than applying one uniform suffix.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- `pnpm run guard:qa-tags` → exit 0, with `config/qa/tag-baseline.json` untouched.
- `pnpm test` → green (titles changed, behavior identical).
- Focused audit of the 14 files shows 0 untagged titles.

Tasks:

1. Tag all untagged titles in the 14 files with accurate vocabulary.
2. Run `governance:run-gates --spec MS-foundation-tag-debt-cleanup --record`; advance
   with `governance:advance`.
