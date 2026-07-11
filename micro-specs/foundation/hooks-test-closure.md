---
spec_id: MS-foundation-hooks-test-closure
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/foundation/**
  - micro-specs/evidence/**
  - tests/hooks/**
implementation_surfaces:
  - micro-specs/foundation/hooks-test-closure.md
  - tests/hooks/**
related_docs:
  - docs/qa/full-suite.md
related_tests:
  - tests/hooks/useOpsBookings.test.tsx
  - tests/hooks/useSupabaseSession.test.tsx
  - tests/hooks/useBookingsTableState.test.ts
  - tests/hooks/useDeleteRestaurant.test.tsx
  - tests/hooks/useOpsCancelBooking.test.tsx
  - tests/hooks/useOpsBookingsDialogs.test.tsx
  - tests/hooks/useOpsBookingsLifecycleHandlers.test.tsx
  - tests/hooks/useOpsEmailTemplatesPageState.test.tsx
verification_gates:
  - pnpm governance:check
  - pnpm test
  - pnpm lint
  - pnpm typecheck
  - pnpm run qa:foundation
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - The enumerated hook inventory with per-hook classification (logic vs trivial).
approved_exceptions: []
---

# MS-foundation-hooks-test-closure — Close untested hook gaps

## 1. Exact Goal and User-Visible Outcomes

Every logic-bearing React hook has a behavioral test. The 2026-07-11 audit found 49
of 76 hooks unreferenced by any test — including booking-critical ones
(`hooks/useOpsBookings`, `hooks/useBookingsTableState`, `hooks/useBookingHistory`,
`hooks/useSupabaseSession`, `hooks/useProfile`, `hooks/useGuestPreferences`) and 31
of 44 `src/hooks/ops/*` hooks. When this ships, each untested hook is either (a)
covered by a `renderHook`-based suite exercising its states and edge cases, or (b)
explicitly classified as a trivial pass-through (thin `useQuery` wrapper with no
transform/branch logic) in the recorded inventory — with zero hooks left
unclassified.

## 2. Blast Radius

In scope: new test files under `tests/hooks/**` (one per hook, mirroring source
names), this spec, and its evidence ledger.

Out of scope: ALL product source (defects found are reported, not fixed here);
existing hook tests; component-level testing of hook consumers (component-closure
spec owns that).

## 3. Strict Constraints and Assumptions

- Use `renderHook` from `@testing-library/react` with a `QueryClientProvider`
  wrapper where hooks use React Query (copy conventions from
  `tests/hooks/useCreateReservation.test.tsx`); mock fetch/Supabase at the same
  seams sibling tests use.
- Edge-case floor per logic-bearing hook: initial state, success path, error path,
  and every branch the hook itself owns (debounce timing, pagination cursors,
  optimistic updates, retry/invalidations, session-expiry) — with fake timers for
  time-based hooks (`use-debounced-value`, `use-countdown`).
- Classification honesty: a hook is only "trivial" if it contains no conditional
  logic, no data transformation, and no timer/subscription management; the
  inventory in the implementation report lists every hook with its classification
  so the claim is auditable.
- Tags accurate (`@contract`, `@local-only` where fitting); tag ratchet green;
  deterministic under any clock/TZ.

## 4. Decisions Already Made

- Enumerate untested hooks mechanically (hooks/ and src/hooks trees vs references
  in tests/) at implementation start; the audit counts above are the expected
  ballpark, the enumeration is the source of truth.
- Query-wrapper hooks with a `select`/transform DO count as logic-bearing (the
  transform gets tested).
- One test file per hook; no umbrella files.

## 5. Behavioral Requirements (EARS)

- THE hook inventory SHALL classify every currently-untested hook as logic-bearing
  or trivial, with zero unclassified.
- THE logic-bearing hooks SHALL each gain a suite meeting the edge-case floor.
- WHILE timer-based hooks are tested, THE suites SHALL use fake timers and stay
  deterministic.
- IF a hook test exposes a real product defect, THEN THE implementer SHALL report
  it and pin current behavior with a KNOWN-ISSUE marker.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- All new suites pass under `pnpm test`; full suite green; tag guard green.
- The reported inventory covers 100% of untested hooks with a classification.
- All declared verification gates pass.

Tasks:

1. Enumerate + classify all untested hooks.
2. Write suites for logic-bearing hooks (root `hooks/` first, then
   `src/hooks/ops`).
3. Record gates via `governance:run-gates --spec MS-foundation-hooks-test-closure --record`;
   advance lifecycle.
